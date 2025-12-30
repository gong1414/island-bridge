package cmd

import (
	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
	rsync "github.com/gong1414/island-bridge/internal/sync"
)

var (
	syncDirection string // upload, download, or auto (from config)
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Synchronize files with remote server",
	Long: `Build a bridge and synchronize files between your local and remote islands.

The sync direction is determined by:
1. The --direction flag (if specified)
2. The project's "mode" setting in configuration

Sync modes:
  one-way-local   Upload local files to remote (default)
  one-way-remote  Download remote files to local
  two-way         Bidirectional synchronization`,
	Run: runSync,
}

func init() {
	syncCmd.Flags().StringVarP(&syncDirection, "direction", "d", "",
		"sync direction: upload (local→remote), download (remote→local), or both")
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
	client, err := ssh.NewClientWithOptions(profile, ssh.ClientOptions{
		InsecureSkipHostKey: GetInsecureSkipHostKey(),
	})
	if err != nil {
		exitWithError("failed to connect to remote", err)
	}
	defer client.Close()

	// Determine sync direction
	direction := determineSyncDirection(project)

	// Show sync info
	switch direction {
	case rsync.DirectionUpload:
		color.Blue("🔼 Sync mode: upload (local → remote)")
	case rsync.DirectionDownload:
		color.Blue("🔽 Sync mode: download (remote → local)")
	case rsync.DirectionBoth:
		color.Blue("🔄 Sync mode: bidirectional")
	}

	// Perform sync
	syncer := rsync.NewSyncer(client, project)
	if err := syncer.Sync(direction); err != nil {
		exitWithError("sync failed", err)
	}
}

// determineSyncDirection determines the sync direction from flag or config
func determineSyncDirection(project *config.Project) rsync.SyncDirection {
	// Flag takes precedence
	if syncDirection != "" {
		switch syncDirection {
		case "upload", "up", "push":
			return rsync.DirectionUpload
		case "download", "down", "pull":
			return rsync.DirectionDownload
		case "both", "bidirectional", "two-way":
			return rsync.DirectionBoth
		default:
			color.Yellow("Warning: unknown direction %q, using config mode", syncDirection)
		}
	}

	// Use project config mode
	return rsync.GetDirectionFromMode(project.GetMode())
}
