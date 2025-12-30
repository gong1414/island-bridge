// Package ssh provides SSH/SFTP client functionality
package ssh

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/gong1414/island-bridge/internal/config"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// Client wraps SSH and SFTP connections
type Client struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	profile    *config.Profile
}

// NewClient creates a new SSH client from a profile
func NewClient(profile *config.Profile) (*Client, error) {
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

	sshConfig := &ssh.ClientConfig{
		User:            profile.User,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
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

	if _, err := io.Copy(remoteFile, localFile); err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
	}

	// Preserve file permissions
	info, _ := os.Stat(localPath)
	if info != nil {
		c.sftpClient.Chmod(remotePath, info.Mode())
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

	if _, err := io.Copy(localFile, remoteFile); err != nil {
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

