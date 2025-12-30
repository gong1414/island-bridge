package cmd

import (
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
	rsync "github.com/gong1414/island-bridge/internal/sync"
	"github.com/spf13/cobra"
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Synchronize files with remote server",
	Long:  "Build a bridge and synchronize files from your local island to the remote island",
	Run:   runSync,
}

func init() {
	rootCmd.AddCommand(syncCmd)
}

func runSync(cmd *cobra.Command, args []string) {
	cfg, err := config.Load()
	if err != nil {
		exitWithError("failed to load config", err)
	}

	if len(cfg.Projects) == 0 {
		exitWithError("no projects configured. Run 'ibridge init' first", nil)
	}

	// Get project (use first one or specified)
	var project *config.Project
	projName, _ := getProjectAndProfile()
	if projName != "" {
		project, err = cfg.GetProject(projName)
		if err != nil {
			exitWithError("project not found", err)
		}
	} else {
		project = &cfg.Projects[0]
	}

	// Get profile
	profile, err := cfg.GetProfile(project.Profile)
	if err != nil {
		exitWithError("profile not found", err)
	}

	// Connect to remote
	client, err := ssh.NewClient(profile)
	if err != nil {
		exitWithError("failed to connect to remote", err)
	}
	defer client.Close()

	// Perform sync
	syncer := rsync.NewSyncer(client, project)
	if err := syncer.SyncAll(); err != nil {
		exitWithError("sync failed", err)
	}
}

