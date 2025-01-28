import fs from "fs";

export class Pkgwatch {
  getDependencies() {
    const packageJson = fs.readFileSync("package.json", "utf8");
    const dependencies = JSON.parse(packageJson).dependencies;
    const devDependencies = JSON.parse(packageJson).devDependencies;
    return { dependencies, devDependencies };
  }
  async r() {
    const { dependencies } = this.getDependencies();
    const results = {};
    const inquirer = (await import("inquirer")).default;
    const { exec } = await import("child_process");
    const util = await import("util");
    const execPromise = util.promisify(exec);

    let hasOutdatedDeps = false;

    // Get latest version for each dependency
    for (const [pkg, currentVersion] of Object.entries(dependencies)) {
      try {
        const response = await fetch(
          `https://registry.npmjs.org/${pkg}/latest`
        );
        const data = await response.json();
        const latestVersion = data.version;
        const cleanCurrentVersion = currentVersion.replace(/[\^~]/g, "");

        if (cleanCurrentVersion !== latestVersion) {
          hasOutdatedDeps = true;
          console.log(
            `Package ${pkg} is outdated. Current: ${cleanCurrentVersion}, Latest: ${latestVersion}`
          );

          const answer = await inquirer.prompt([
            {
              type: "confirm",
              name: "update",
              message: `Do you want to update ${pkg} to version ${latestVersion}?`,
              default: false,
            },
          ]);

          if (answer.update) {
            try {
              console.log(`Updating ${pkg}...`);
              await execPromise(`npm uninstall ${pkg}`);
              await execPromise(`npm install ${pkg}@${latestVersion}`);
              console.log(
                `Successfully updated ${pkg} to version ${latestVersion}`
              );
            } catch (error) {
              console.error(`Failed to update ${pkg}: ${error.message}`);
            }
          }
        }

        results[pkg] = {
          current: currentVersion,
          latest: latestVersion,
        };
      } catch (error) {
        hasOutdatedDeps = true;
        results[pkg] = {
          current: currentVersion,
          error: "Failed to fetch latest version",
        };
      }
    }

    if (!hasOutdatedDeps) {
      console.log("\x1b[32m%s\x1b[0m", "All dependencies are up to date!");
    }

    return results;
  }
}
