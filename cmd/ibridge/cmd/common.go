// Package cmd provides CLI commands for island-bridge
package cmd

import (
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
)

// ProjectContext holds the initialized context for a project command
type ProjectContext struct {
	Config  *config.Config
	Project *config.Project
	Profile *config.Profile
	Client  *ssh.Client
}

// InitProjectContext initializes the common context needed for project commands.
// It loads configuration, resolves the project and profile, and creates an SSH client.
// The caller is responsible for closing the SSH client when done.
func InitProjectContext() (*ProjectContext, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, &CommandError{Message: "failed to load config", Err: err}
	}

	// Validate configuration
	if err := cfg.Validate(); err != nil {
		return nil, &CommandError{Message: "invalid configuration", Err: err}
	}

	if len(cfg.Projects) == 0 {
		return nil, &CommandError{Message: "no projects configured. Run 'ibridge init' first"}
	}

	// Get project (use first one or specified)
	var project *config.Project
	projName, _ := getProjectAndProfile()
	if projName != "" {
		project, err = cfg.GetProject(projName)
		if err != nil {
			return nil, &CommandError{Message: "project not found", Err: err}
		}
	} else {
		project = &cfg.Projects[0]
	}

	// Get profile
	profile, err := cfg.GetProfile(project.Profile)
	if err != nil {
		return nil, &CommandError{Message: "profile not found", Err: err}
	}

	// Connect to remote
	client, err := ssh.NewClientWithOptions(profile, ssh.ClientOptions{
		InsecureSkipHostKey: GetInsecureSkipHostKey(),
	})
	if err != nil {
		return nil, &CommandError{Message: "failed to connect to remote", Err: err}
	}

	return &ProjectContext{
		Config:  cfg,
		Project: project,
		Profile: profile,
		Client:  client,
	}, nil
}

// Close closes the SSH client connection
func (ctx *ProjectContext) Close() error {
	if ctx.Client != nil {
		return ctx.Client.Close()
	}
	return nil
}

// CommandError represents a command execution error
type CommandError struct {
	Message string
	Err     error
}

func (e *CommandError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

// MustInitProjectContext initializes project context and exits on error
func MustInitProjectContext() *ProjectContext {
	ctx, err := InitProjectContext()
	if err != nil {
		if cmdErr, ok := err.(*CommandError); ok {
			exitWithError(cmdErr.Message, cmdErr.Err)
		}
		exitWithError("initialization failed", err)
	}
	return ctx
}
