package cmd

import (
	"fmt"
	"strings"

	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
	"github.com/gong1414/island-bridge/internal/vcs"
)

var gitCmd = &cobra.Command{
	Use:   "git",
	Short: "Execute Git commands on remote server",
	Long:  "Execute Git commands on the remote server via SSH",
}

var gitStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show git status on remote",
	Run:   runGitStatus,
}

var gitDiffCmd = &cobra.Command{
	Use:   "diff [files...]",
	Short: "Show git diff on remote",
	Run:   runGitDiff,
}

var gitAddCmd = &cobra.Command{
	Use:   "add [files...]",
	Short: "Stage files on remote",
	Run:   runGitAdd,
}

var commitMessage string

var gitCommitCmd = &cobra.Command{
	Use:   "commit",
	Short: "Commit changes on remote",
	Run:   runGitCommit,
}

var gitPushCmd = &cobra.Command{
	Use:   "push",
	Short: "Push commits to remote repository",
	Run:   runGitPush,
}

var gitPullCmd = &cobra.Command{
	Use:   "pull",
	Short: "Pull from remote repository",
	Run:   runGitPull,
}

func init() {
	gitCommitCmd.Flags().StringVarP(&commitMessage, "message", "m", "", "commit message")
	_ = gitCommitCmd.MarkFlagRequired("message")

	gitCmd.AddCommand(gitStatusCmd)
	gitCmd.AddCommand(gitDiffCmd)
	gitCmd.AddCommand(gitAddCmd)
	gitCmd.AddCommand(gitCommitCmd)
	gitCmd.AddCommand(gitPushCmd)
	gitCmd.AddCommand(gitPullCmd)
	rootCmd.AddCommand(gitCmd)
}

func getGitProvider() *vcs.GitProvider {
	cfg, err := config.Load()
	if err != nil {
		exitWithError("failed to load config", err)
	}

	if len(cfg.Projects) == 0 {
		exitWithError("no projects configured", nil)
	}

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

	profile, err := cfg.GetProfile(project.Profile)
	if err != nil {
		exitWithError("profile not found", err)
	}

	client, err := ssh.NewClientWithOptions(profile, ssh.ClientOptions{
		InsecureSkipHostKey: GetInsecureSkipHostKey(),
	})
	if err != nil {
		exitWithError("failed to connect", err)
	}

	return vcs.NewGitProvider(client, project)
}

func runGitStatus(cmd *cobra.Command, args []string) {
	git := getGitProvider()
	output, err := git.Status()
	if err != nil {
		color.Red("Error: %v", err)
		return
	}
	fmt.Print(output)
}

func runGitDiff(cmd *cobra.Command, args []string) {
	git := getGitProvider()
	output, err := git.Diff(args...)
	if err != nil {
		color.Red("Error: %v", err)
		return
	}
	fmt.Print(output)
}

func runGitAdd(cmd *cobra.Command, args []string) {
	git := getGitProvider()
	output, err := git.Add(args...)
	if err != nil {
		color.Red("Error: %v", err)
		return
	}
	if strings.TrimSpace(output) == "" {
		color.Green("✓ Files staged successfully")
	} else {
		fmt.Print(output)
	}
}

func runGitCommit(cmd *cobra.Command, args []string) {
	git := getGitProvider()
	output, err := git.Commit(commitMessage)
	if err != nil {
		color.Red("Error: %v", err)
		return
	}
	fmt.Print(output)
}

func runGitPush(cmd *cobra.Command, args []string) {
	git := getGitProvider()
	output, err := git.Push()
	if err != nil {
		color.Red("Error: %v", err)
		return
	}
	if strings.TrimSpace(output) == "" {
		color.Green("✓ Pushed successfully")
	} else {
		fmt.Print(output)
	}
}

func runGitPull(cmd *cobra.Command, args []string) {
	git := getGitProvider()
	output, err := git.Pull()
	if err != nil {
		color.Red("Error: %v", err)
		return
	}
	fmt.Print(output)
}
