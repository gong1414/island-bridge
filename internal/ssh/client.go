// Package ssh provides SSH/SFTP client functionality
package ssh

import (
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"

	"github.com/gong1414/island-bridge/internal/config"
)

// ClientOptions provides options for creating SSH client
type ClientOptions struct {
	InsecureSkipHostKey bool
}

// Client wraps SSH and SFTP connections
type Client struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	profile    *config.Profile
}

// NewClient creates a new SSH client from a profile with default options
func NewClient(profile *config.Profile) (*Client, error) {
	return NewClientWithOptions(profile, ClientOptions{InsecureSkipHostKey: false})
}

// NewClientWithOptions creates a new SSH client from a profile with custom options
func NewClientWithOptions(profile *config.Profile, opts ClientOptions) (*Client, error) {
	var authMethods []ssh.AuthMethod

	// Try to use SSH key
	keyPath := profile.KeyPath
	if keyPath == "" {
		home, _ := os.UserHomeDir()
		keyPath = filepath.Join(home, ".ssh", "id_rsa")
	}

	if key, err := os.ReadFile(keyPath); err == nil {
		signer, err := ssh.ParsePrivateKey(key)
		if err == nil {
			authMethods = append(authMethods, ssh.PublicKeys(signer))
		}
	}

	// Also try ed25519 key
	if len(authMethods) == 0 {
		home, _ := os.UserHomeDir()
		ed25519Path := filepath.Join(home, ".ssh", "id_ed25519")
		if key, err := os.ReadFile(ed25519Path); err == nil {
			signer, err := ssh.ParsePrivateKey(key)
			if err == nil {
				authMethods = append(authMethods, ssh.PublicKeys(signer))
			}
		}
	}

	if len(authMethods) == 0 {
		return nil, fmt.Errorf("no valid SSH authentication method found")
	}

	port := profile.Port
	if port == 0 {
		port = 22
	}

	// Get host key callback
	hostKeyCallback, err := getHostKeyCallback(opts.InsecureSkipHostKey)
	if err != nil {
		return nil, fmt.Errorf("failed to setup host key verification: %w", err)
	}

	sshConfig := &ssh.ClientConfig{
		User:            profile.User,
		Auth:            authMethods,
		HostKeyCallback: hostKeyCallback,
		Timeout:         30 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", profile.Host, port)
	sshClient, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", addr, err)
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return nil, fmt.Errorf("failed to create SFTP client: %w", err)
	}

	return &Client{
		sshClient:  sshClient,
		sftpClient: sftpClient,
		profile:    profile,
	}, nil
}

// getHostKeyCallback returns appropriate host key callback
func getHostKeyCallback(insecure bool) (ssh.HostKeyCallback, error) {
	if insecure {
		return ssh.InsecureIgnoreHostKey(), nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	knownHostsPath := filepath.Join(home, ".ssh", "known_hosts")

	// Check if known_hosts exists
	if _, err := os.Stat(knownHostsPath); os.IsNotExist(err) {
		// Create the file if it doesn't exist
		if err := os.MkdirAll(filepath.Dir(knownHostsPath), 0700); err != nil {
			return nil, err
		}
		if err := os.WriteFile(knownHostsPath, []byte{}, 0600); err != nil {
			return nil, err
		}
	}

	// Use knownhosts callback with custom handling for unknown hosts
	callback, err := knownhosts.New(knownHostsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to parse known_hosts: %w", err)
	}

	// Wrap the callback to handle unknown hosts
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		err := callback(hostname, remote, key)
		if err != nil {
			// Check if it's an unknown host error
			if keyErr, ok := err.(*knownhosts.KeyError); ok && len(keyErr.Want) == 0 {
				// Host not in known_hosts, add it automatically with user notification
				fmt.Printf("Warning: Permanently adding '%s' to known hosts.\n", hostname)
				if addErr := addHostKey(knownHostsPath, hostname, key); addErr != nil {
					return fmt.Errorf("failed to add host key: %w", addErr)
				}
				return nil
			}
			return err
		}
		return nil
	}, nil
}

// addHostKey adds a new host key to known_hosts file
func addHostKey(path, hostname string, key ssh.PublicKey) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()

	// Normalize hostname (remove port if it's 22)
	normalizedHost := normalizeHostname(hostname)
	line := knownhosts.Line([]string{normalizedHost}, key)
	_, err = fmt.Fprintln(f, line)
	return err
}

// normalizeHostname removes the default SSH port from hostname
func normalizeHostname(hostname string) string {
	// If it ends with :22, remove it
	if strings.HasSuffix(hostname, ":22") {
		return strings.TrimSuffix(hostname, ":22")
	}
	return hostname
}

// Close closes both SSH and SFTP connections
func (c *Client) Close() error {
	if c.sftpClient != nil {
		c.sftpClient.Close()
	}
	if c.sshClient != nil {
		return c.sshClient.Close()
	}
	return nil
}

// Exec executes a command on the remote server
func (c *Client) Exec(cmd string) (string, error) {
	session, err := c.sshClient.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	return string(output), err
}

// UploadFile uploads a local file to the remote server
func (c *Client) UploadFile(localPath, remotePath string) error {
	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("failed to open local file: %w", err)
	}
	defer localFile.Close()

	// Create remote directory if needed
	remoteDir := filepath.Dir(remotePath)
	if err := c.MkdirAll(remoteDir); err != nil {
		return err
	}

	remoteFile, err := c.sftpClient.Create(remotePath)
	if err != nil {
		return fmt.Errorf("failed to create remote file: %w", err)
	}
	defer remoteFile.Close()

	// Use buffered copying for better performance
	buf := make([]byte, 64*1024) // 64KB buffer
	if _, err := io.CopyBuffer(remoteFile, localFile, buf); err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
	}

	// Preserve file permissions
	info, _ := os.Stat(localPath)
	if info != nil {
		_ = c.sftpClient.Chmod(remotePath, info.Mode())
	}

	return nil
}

// DownloadFile downloads a remote file to local
func (c *Client) DownloadFile(remotePath, localPath string) error {
	remoteFile, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file: %w", err)
	}
	defer remoteFile.Close()

	// Create local directory if needed
	localDir := filepath.Dir(localPath)
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return err
	}

	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}
	defer localFile.Close()

	// Use buffered copying for better performance
	buf := make([]byte, 64*1024) // 64KB buffer
	if _, err := io.CopyBuffer(localFile, remoteFile, buf); err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
	}

	return nil
}

// MkdirAll creates a directory and all parent directories
func (c *Client) MkdirAll(path string) error {
	return c.sftpClient.MkdirAll(path)
}

// Remove removes a file or empty directory
func (c *Client) Remove(path string) error {
	return c.sftpClient.Remove(path)
}

// Stat returns file info for a remote path
func (c *Client) Stat(path string) (os.FileInfo, error) {
	return c.sftpClient.Stat(path)
}

// ReadDir reads a directory on the remote server
func (c *Client) ReadDir(path string) ([]os.FileInfo, error) {
	return c.sftpClient.ReadDir(path)
}

// Exists checks if a remote path exists
func (c *Client) Exists(path string) bool {
	_, err := c.sftpClient.Stat(path)
	return err == nil
}
