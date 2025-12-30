package cmd

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/fatih/color"
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
	rsync "github.com/gong1414/island-bridge/internal/sync"
	"github.com/gong1414/island-bridge/internal/watch"
	"github.com/spf13/cobra"
)

var (
	noInitialSync bool
)

var watchCmd = &cobra.Command{
	Use:   "watch",
	Short: "Watch for file changes and sync automatically",
	Long:  "Keep the bridge open - watch for changes on your local island and sync to remote",
	Run:   runWatch,
}

func init() {
	watchCmd.Flags().BoolVar(&noInitialSync, "no-initial-sync", false, "skip initial full sync")
	rootCmd.AddCommand(watchCmd)
}

func runWatch(cmd *cobra.Command, args []string) {
	cfg, err := config.Load()
	if err != nil {
		exitWithError("failed to load config", err)
	}

	if len(cfg.Projects) == 0 {
		exitWithError("no projects configured. Run 'ibridge init' first", nil)
	}

	// Get project
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

	// Create syncer
	syncer := rsync.NewSyncer(client, project)

	// Perform initial sync unless disabled
	if !noInitialSync {
		color.Blue("Performing initial sync...")
		if err := syncer.SyncAll(); err != nil {
			exitWithError("initial sync failed", err)
		}
	}

	// Create watcher
	watcher, err := watch.NewWatcher(syncer, project)
	if err != nil {
		exitWithError("failed to create watcher", err)
	}
	defer watcher.Close()

	// Handle shutdown gracefully
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		color.Yellow("\nShutting down...")
		watcher.Close()
		client.Close()
		os.Exit(0)
	}()

	// Start watching
	if err := watcher.Start(); err != nil {
		exitWithError("watcher error", err)
	}
}

