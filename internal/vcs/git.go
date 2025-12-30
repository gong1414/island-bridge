// Package vcs provides version control system integration
package vcs

import (
	"fmt"
	"strings"

	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
)

// VCSProvider defines the interface for version control operations
type VCSProvider interface {
	Status() (string, error)
	Diff(files ...string) (string, error)
	Add(files ...string) (string, error)
	Commit(message string) (string, error)
	Push() (string, error)
	Pull() (string, error)
}

// GitProvider implements VCSProvider for Git
type GitProvider struct {
	client     *ssh.Client
	remotePath string
}

// NewGitProvider creates a new Git provider
func NewGitProvider(client *ssh.Client, project *config.Project) *GitProvider {
	return &GitProvider{
		client:     client,
		remotePath: project.RemotePath,
	}
}

func (g *GitProvider) runGit(args ...string) (string, error) {
	cmd := fmt.Sprintf("cd %s && git %s", g.remotePath, strings.Join(args, " "))
	output, err := g.client.Exec(cmd)
	if err != nil {
		// Check if it's a git error with output
		if output != "" {
			return output, fmt.Errorf("git command failed: %s", strings.TrimSpace(output))
		}
		return "", err
	}
	return output, nil
}

// Status returns git status
func (g *GitProvider) Status() (string, error) {
	return g.runGit("status")
}

// Diff returns git diff
func (g *GitProvider) Diff(files ...string) (string, error) {
	args := []string{"diff"}
	args = append(args, files...)
	return g.runGit(args...)
}

// Add stages files
func (g *GitProvider) Add(files ...string) (string, error) {
	if len(files) == 0 {
		files = []string{"."}
	}
	args := []string{"add"}
	args = append(args, files...)
	return g.runGit(args...)
}

// Commit commits staged changes
func (g *GitProvider) Commit(message string) (string, error) {
	return g.runGit("commit", "-m", fmt.Sprintf("%q", message))
}

// Push pushes commits to remote
func (g *GitProvider) Push() (string, error) {
	return g.runGit("push")
}

// Pull pulls from remote
func (g *GitProvider) Pull() (string, error) {
	return g.runGit("pull")
}

// Log returns git log
func (g *GitProvider) Log(n int) (string, error) {
	return g.runGit("log", fmt.Sprintf("-n%d", n), "--oneline")
}

// Branch returns current branch
func (g *GitProvider) Branch() (string, error) {
	return g.runGit("branch", "--show-current")
}

