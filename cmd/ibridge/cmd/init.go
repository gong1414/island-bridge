package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"github.com/gong1414/island-bridge/internal/config"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a new island-bridge configuration",
	Long:  "Create a new .island-bridge.json configuration file in the current directory",
	Run:   runInit,
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func runInit(cmd *cobra.Command, args []string) {
	reader := bufio.NewReader(os.Stdin)

	color.Blue("🏝️  Welcome to Island Bridge configuration wizard!\n")

	// Get profile info
	fmt.Print("Profile name [default]: ")
	profileName, _ := reader.ReadString('\n')
	profileName = strings.TrimSpace(profileName)
	if profileName == "" {
		profileName = "default"
	}

	fmt.Print("Remote host: ")
	host, _ := reader.ReadString('\n')
	host = strings.TrimSpace(host)
	if host == "" {
		exitWithError("host is required", nil)
	}

	fmt.Print("SSH port [22]: ")
	portStr, _ := reader.ReadString('\n')
	portStr = strings.TrimSpace(portStr)
	port := 22
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}

	fmt.Print("SSH user: ")
	user, _ := reader.ReadString('\n')
	user = strings.TrimSpace(user)
	if user == "" {
		exitWithError("user is required", nil)
	}

	// Get project info
	fmt.Print("Project name [current-dir]: ")
	projName, _ := reader.ReadString('\n')
	projName = strings.TrimSpace(projName)
	if projName == "" {
		cwd, _ := os.Getwd()
		projName = cwd[strings.LastIndex(cwd, "/")+1:]
	}

	fmt.Print("Remote path: ")
	remotePath, _ := reader.ReadString('\n')
	remotePath = strings.TrimSpace(remotePath)
	if remotePath == "" {
		exitWithError("remote path is required", nil)
	}

	// Create config
	cfg := &config.Config{
		Version: "1",
		Profiles: []config.Profile{
			{
				Name: profileName,
				Host: host,
				Port: port,
				User: user,
			},
		},
		Projects: []config.Project{
			{
				Name:       projName,
				Profile:    profileName,
				LocalPath:  "./",
				RemotePath: remotePath,
				Mode:       "one-way-local",
				Watch:      true,
				Ignore:     []string{".git", "node_modules", ".island-bridge.json", "*.log", ".DS_Store"},
			},
		},
	}

	if err := cfg.Save(config.ProjectConfigPath()); err != nil {
		exitWithError("failed to save config", err)
	}

	color.Green("\n🌉 Configuration saved to .island-bridge.json")
	color.Blue("\nNext steps:")
	fmt.Println("  1. Run 'ibridge sync' to perform initial sync")
	fmt.Println("  2. Run 'ibridge watch' to start watching for changes")
}
