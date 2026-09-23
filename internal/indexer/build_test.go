package indexer

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestBuildCreatesPerSiteIndexWithoutCopyingSources(t *testing.T) {
	repositoryRoot := initializeGitRepository(t)
	restoreWorkingDirectory := chdirForTest(t, repositoryRoot)
	defer restoreWorkingDirectory()

	writeFixtureFile(t, repositoryRoot, "artifacts/index.html", "<title>Site landing page</title>")
	writeFixtureFile(t, repositoryRoot, "artifacts/architecture/platform/index.html", `<!doctype html><title>Platform topology</title><h1 id="overview">Overview</h1>`)
	incidentHTML := `<!doctype html>
<html><head><title>Checkout latency review</title></head><body>
<h1 id="summary">Summary</h1>
<h2 id="root-cause">Root <span>cause</span></h2>
<h2>Heading without an id</h2>
<h3 id="follow-up">Follow-up<script>ignored text</script></h3>
</body></html>`
	writeFixtureFile(t, repositoryRoot, "artifacts/incidents/checkout-latency/index.html", incidentHTML)
	writeFixtureFile(t, repositoryRoot, "artifacts/incidents/checkout-latency/assets/css/styles.css", "body { color: navy; }\n")
	writeFixtureFile(t, repositoryRoot, "artifacts/incidents/checkout-latency/assets/data.json", `{"status":"resolved"}`)
	commitTime := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	commitFixture(t, repositoryRoot, "add representative artifacts", commitTime)
	runGit(t, repositoryRoot, "remote", "add", "origin", "git@github.com:acme/knowledge.git")

	generatedAt := time.Date(2026, 2, 3, 4, 5, 6, 0, time.UTC)
	result, err := Build(context.Background(), BuildOptions{
		SiteID:    "sre",
		SiteTitle: "SRE",
		SourceDir: "artifacts",
		OutputDir: ".local/storage",
		Now:       func() time.Time { return generatedAt },
	})
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if result.FilesScanned != 5 {
		t.Errorf("FilesScanned = %d, want 5", result.FilesScanned)
	}
	if result.ArtifactsIndexed != 2 {
		t.Errorf("ArtifactsIndexed = %d, want 2", result.ArtifactsIndexed)
	}
	if result.OutputBytes == 0 || result.Elapsed <= 0 {
		t.Errorf("Build() returned empty metrics: %+v", result)
	}

	indexBytes, err := os.ReadFile(filepath.Join(repositoryRoot, ".local/storage/_indexes/sre.json"))
	if err != nil {
		t.Fatalf("read generated site index: %v", err)
	}
	var index SiteIndex
	if err := json.Unmarshal(indexBytes, &index); err != nil {
		t.Fatalf("decode generated site index: %v", err)
	}
	if index.SchemaVersion != 1 || index.Site != (SiteSummary{ID: "sre", Title: "SRE"}) {
		t.Errorf("site metadata = (%d, %+v), want schema 1 and SRE", index.SchemaVersion, index.Site)
	}
	if index.GeneratedAt != generatedAt.Format(time.RFC3339) {
		t.Errorf("GeneratedAt = %q, want %q", index.GeneratedAt, generatedAt.Format(time.RFC3339))
	}
	if len(index.Artifacts) != 2 {
		t.Fatalf("got %d artifacts, want 2", len(index.Artifacts))
	}

	architecture := index.Artifacts[0]
	if architecture.ID != "architecture/platform" || architecture.Title != "Platform topology" {
		t.Errorf("first artifact = %+v, want architecture/platform with extracted title", architecture)
	}
	if architecture.ArtifactURL != "/_artifacts/sre/architecture/platform/index.html" {
		t.Errorf("architecture artifactUrl = %q", architecture.ArtifactURL)
	}
	if architecture.Source == nil || architecture.Source.Repository != "acme/knowledge" || architecture.Source.RepositoryURL != "https://github.com/acme/knowledge" || architecture.Source.Ref != "main" {
		t.Errorf("architecture source metadata = %+v", architecture.Source)
	}
	if architecture.UpdatedAt != commitTime.Format(time.RFC3339) {
		t.Errorf("architecture updatedAt = %q, want %q", architecture.UpdatedAt, commitTime.Format(time.RFC3339))
	}
	if len(architecture.TOC) != 1 || architecture.TOC[0] != (TOCEntry{Level: 1, Text: "Overview", ID: "overview"}) {
		t.Errorf("architecture TOC = %+v", architecture.TOC)
	}

	incident := index.Artifacts[1]
	if incident.ID != "incidents/checkout-latency" || incident.Title != "Checkout latency review" {
		t.Errorf("incident artifact = %+v, want extracted title and relative path", incident)
	}
	if incident.Filename != "index.html" || incident.ArtifactURL != "/_artifacts/sre/incidents/checkout-latency/index.html" {
		t.Errorf("incident file metadata = filename %q, URL %q", incident.Filename, incident.ArtifactURL)
	}
	wantTOC := []TOCEntry{
		{Level: 1, Text: "Summary", ID: "summary"},
		{Level: 2, Text: "Root cause", ID: "root-cause"},
		{Level: 3, Text: "Follow-up", ID: "follow-up"},
	}
	if len(incident.TOC) != len(wantTOC) {
		t.Fatalf("incident TOC = %+v, want %+v", incident.TOC, wantTOC)
	}
	for i := range wantTOC {
		if incident.TOC[i] != wantTOC[i] {
			t.Errorf("incident TOC[%d] = %+v, want %+v", i, incident.TOC[i], wantTOC[i])
		}
	}
	if incident.UpdatedAt != commitTime.Format(time.RFC3339) {
		t.Errorf("incident updatedAt = %q, want %q", incident.UpdatedAt, commitTime.Format(time.RFC3339))
	}

	unchanged, err := os.ReadFile(filepath.Join(repositoryRoot, "artifacts/incidents/checkout-latency/index.html"))
	if err != nil {
		t.Fatal(err)
	}
	if string(unchanged) != incidentHTML {
		t.Error("Build() modified the source artifact")
	}
	if _, err := os.Stat(filepath.Join(repositoryRoot, ".local/storage/_artifacts")); !os.IsNotExist(err) {
		t.Errorf("Build() should write only the index, _artifacts exists or stat failed: %v", err)
	}
}

func TestBuildUpdatedAtTracksUncommittedAndCommittedAssetChanges(t *testing.T) {
	repositoryRoot := initializeGitRepository(t)
	restoreWorkingDirectory := chdirForTest(t, repositoryRoot)
	defer restoreWorkingDirectory()

	writeFixtureFile(t, repositoryRoot, "artifacts/reports/latency/index.html", `<title>Latency report</title><h1 id="summary">Summary</h1>`)
	assetPath := filepath.Join(repositoryRoot, "artifacts/reports/latency/assets/report.css")
	writeFixtureFile(t, repositoryRoot, "artifacts/reports/latency/assets/report.css", "body { color: black; }\n")
	firstCommit := time.Date(2026, 3, 1, 9, 0, 0, 0, time.UTC)
	commitFixture(t, repositoryRoot, "add report", firstCommit)

	uncommittedTime := time.Date(2026, 3, 2, 10, 0, 0, 0, time.UTC)
	if err := os.WriteFile(assetPath, []byte("body { color: purple; }\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(assetPath, uncommittedTime, uncommittedTime); err != nil {
		t.Fatal(err)
	}
	index := buildAndReadIndex(t, repositoryRoot, "sre")
	if got := index.Artifacts[0].UpdatedAt; got != uncommittedTime.Format(time.RFC3339) {
		t.Errorf("uncommitted asset updatedAt = %q, want %q", got, uncommittedTime.Format(time.RFC3339))
	}

	secondCommit := time.Date(2026, 3, 3, 11, 0, 0, 0, time.UTC)
	commitFixture(t, repositoryRoot, "update report stylesheet", secondCommit)
	index = buildAndReadIndex(t, repositoryRoot, "sre")
	if got := index.Artifacts[0].UpdatedAt; got != secondCommit.Format(time.RFC3339) {
		t.Errorf("committed asset updatedAt = %q, want %q", got, secondCommit.Format(time.RFC3339))
	}
}

func TestBuildRejectsInvalidSiteID(t *testing.T) {
	_, err := Build(context.Background(), BuildOptions{SiteID: "../sre", SourceDir: "."})
	if err == nil || !strings.Contains(err.Error(), "invalid site identifier") {
		t.Fatalf("Build() error = %v, want invalid-site error", err)
	}
}

func TestParseRepositoryRemote(t *testing.T) {
	tests := []struct {
		name       string
		remote     string
		repository string
		url        string
	}{
		{name: "https", remote: "https://github.com/acme/reports.git", repository: "acme/reports", url: "https://github.com/acme/reports"},
		{name: "ssh", remote: "git@github.com:acme/reports.git", repository: "acme/reports", url: "https://github.com/acme/reports"},
		{name: "enterprise", remote: "ssh://git@git.example.com/platform/reports.git", repository: "platform/reports", url: "https://git.example.com/platform/reports"},
		{name: "invalid", remote: "not a remote", repository: "", url: ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gotRepository, gotURL := parseRepositoryRemote(test.remote)
			if gotRepository != test.repository || gotURL != test.url {
				t.Errorf("parseRepositoryRemote(%q) = (%q, %q), want (%q, %q)", test.remote, gotRepository, gotURL, test.repository, test.url)
			}
		})
	}
}

func BenchmarkBuildIndexFiles(b *testing.B) {
	for _, fileCount := range []int{1_000, 5_000, 10_000} {
		b.Run(fmt.Sprintf("%d-files", fileCount), func(b *testing.B) {
			repositoryRoot := initializeGitRepository(b)
			restoreWorkingDirectory := chdirForTest(b, repositoryRoot)
			defer restoreWorkingDirectory()
			writeFixtureFile(b, repositoryRoot, ".gitignore", "/artifacts/\n")
			commitFixture(b, repositoryRoot, "ignore synthetic benchmark artifacts", time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC))

			artifactCount := fileCount / 20
			for artifact := 0; artifact < artifactCount; artifact++ {
				artifactPath := filepath.Join("artifacts", fmt.Sprintf("team-%02d", artifact%10), "year-2026", fmt.Sprintf("group-%02d", artifact%25), fmt.Sprintf("report-%04d", artifact))
				writeFixtureFile(b, repositoryRoot, filepath.Join(artifactPath, "index.html"), fmt.Sprintf("<title>Report %d</title><h1 id=summary>Summary %d</h1>", artifact, artifact))
				for asset := 1; asset < 20; asset++ {
					writeFixtureFile(b, repositoryRoot, filepath.Join(artifactPath, "assets", "data", fmt.Sprintf("file-%02d.json", asset)), fmt.Sprintf(`{"artifact":%d,"asset":%d}`, artifact, asset))
				}
			}
			sampleFixture := filepath.Join("artifacts", "team-00", "year-2026", "group-00", "report-0000", "index.html")
			if _, err := gitOutput(context.Background(), repositoryRoot, "check-ignore", "-q", filepath.ToSlash(sampleFixture)); err != nil {
				b.Fatalf("benchmark fixture %q is not ignored by Git: %v", sampleFixture, err)
			}
			if _, err := gitOutput(context.Background(), repositoryRoot, "ls-files", "--error-unmatch", filepath.ToSlash(sampleFixture)); err == nil {
				b.Fatalf("benchmark fixture %q is tracked by Git", sampleFixture)
			}

			b.ReportAllocs()
			b.ResetTimer()
			for iteration := 0; iteration < b.N; iteration++ {
				_, err := Build(context.Background(), BuildOptions{
					SiteID:    "benchmark",
					SourceDir: "artifacts",
					OutputDir: ".local/storage",
					Now:       func() time.Time { return time.Date(2026, 4, 2, 0, 0, 0, 0, time.UTC) },
				})
				if err != nil {
					b.Fatal(err)
				}
			}
			b.ReportMetric(float64(fileCount), "source-files/op")
		})
	}
}

func buildAndReadIndex(t testing.TB, repositoryRoot, siteID string) SiteIndex {
	t.Helper()
	_, err := Build(context.Background(), BuildOptions{
		SiteID:    siteID,
		SourceDir: "artifacts",
		OutputDir: ".local/storage",
		Now:       func() time.Time { return time.Date(2026, 3, 4, 12, 0, 0, 0, time.UTC) },
	})
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	contents, err := os.ReadFile(filepath.Join(repositoryRoot, ".local/storage/_indexes", siteID+".json"))
	if err != nil {
		t.Fatalf("read generated index: %v", err)
	}
	var index SiteIndex
	if err := json.Unmarshal(contents, &index); err != nil {
		t.Fatalf("decode generated index: %v", err)
	}
	return index
}

func initializeGitRepository(t testing.TB) string {
	t.Helper()
	repositoryRoot := t.TempDir()
	command := exec.Command("git", "init", "--initial-branch=main")
	command.Dir = repositoryRoot
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("initialize Git repository: %v\n%s", err, output)
	}
	return repositoryRoot
}

func chdirForTest(t testing.TB, directory string) func() {
	t.Helper()
	previous, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	if err := os.Chdir(directory); err != nil {
		t.Fatalf("change working directory to %q: %v", directory, err)
	}
	return func() {
		if err := os.Chdir(previous); err != nil {
			t.Fatalf("restore working directory to %q: %v", previous, err)
		}
	}
}

func writeFixtureFile(t testing.TB, root, filename, contents string) {
	t.Helper()
	fullPath := filepath.Join(root, filename)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		t.Fatalf("create fixture directory: %v", err)
	}
	if err := os.WriteFile(fullPath, []byte(contents), 0o644); err != nil {
		t.Fatalf("write fixture %q: %v", filename, err)
	}
}

func commitFixture(t testing.TB, root, message string, committedAt time.Time) {
	t.Helper()
	runGit(t, root, "add", "--all")
	command := exec.Command("git", "-c", "user.name=Index Builder Test", "-c", "user.email=index-builder@example.invalid", "commit", "--quiet", "-m", message)
	command.Dir = root
	date := committedAt.Format(time.RFC3339)
	command.Env = append(os.Environ(), "GIT_AUTHOR_DATE="+date, "GIT_COMMITTER_DATE="+date)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("commit fixture: %v\n%s", err, output)
	}
}

func runGit(t testing.TB, directory string, args ...string) {
	t.Helper()
	command := exec.Command("git", args...)
	command.Dir = directory
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, output)
	}
}
