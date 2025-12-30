// Package vcs provides version control system integration
package vcs

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
)

// Regex to validate safe path and argument characters
var (
	// safePathPattern allows alphanumeric, dots, underscores, hyphens, slashes
	safePathPattern = regexp.MustCompile(`^[a-zA-Z0-9._\-/~]+$`)
	// safeArgPattern allows common safe characters in git arguments
	safeArgPattern = regexp.MustCompile(`^[a-zA-Z0-9._\-/:@=]+$`)
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
	// Validate remote path
	if !isValidPath(g.remotePath) {
		return "", fmt.Errorf("invalid remote path: contains unsafe characters")
	}

	// Validate and quote all arguments
	quotedArgs := make([]string, len(args))
	for i, arg := range args {
		if !isValidArg(arg) {
			return "", fmt.Errorf("invalid argument %q: contains unsafe characters", arg)
		}
		quotedArgs[i] = shellQuote(arg)
	}

	// Build command with proper quoting
	cmd := fmt.Sprintf("cd %s && git %s", shellQuote(g.remotePath), strings.Join(quotedArgs, " "))
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

// isValidPath checks if a path contains only safe characters
func isValidPath(path string) bool {
	if path == "" {
		return false
	}
	return safePathPattern.MatchString(path)
}

// isValidArg checks if an argument contains only safe characters
func isValidArg(arg string) bool {
	if arg == "" {
		return true // Empty args are OK for some git commands
	}
	// Allow quoted strings for commit messages
	if strings.HasPrefix(arg, "\"") && strings.HasSuffix(arg, "\"") {
		return true
	}
	return safeArgPattern.MatchString(arg)
}

// shellQuote properly quotes a string for shell execution
func shellQuote(s string) string {
	// If string is already safe, no quoting needed
	if safePathPattern.MatchString(s) {
		return s
	}
	// Use single quotes and escape any single quotes in the string
	return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'"
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
