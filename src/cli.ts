import * as p from "@clack/prompts";
import color from "picocolors";
import { checkIfFileExists, getFileType } from "./functions";
import { handlers } from "./handlers";

export const runCLI = async () => {
  p.intro(`${color.bgCyan(color.black("Clerk User Migration Utility"))}`);

  const args = await p.group(
    {
      key: () =>
        p.select({
          message: "What platform are you migrating your users from?",
          initialValue: handlers[0].value,
          maxItems: 1,
          options: handlers,
        }),
      file: () =>
        p.text({
          message: "Specify the file to use for importing your users",
          initialValue: "users.json",
          placeholder: "users.json",
          validate: (value) => {
            if (!checkIfFileExists(value)) {
              return "That file does not exist. Please try again";
            }
            if (
              getFileType(value) !== "text/csv" &&
              getFileType(value) !== "application/json"
            ) {
              return "Please supply a valid JSON or CSV file";
            }
          },
        }),
      instance: () =>
        p.select({
          message:
            "Are you importing your users into a production instance? Development instances are for testing and limited to 500 users.",
          initialValue: "prod",
          maxItems: 1,
          options: [
            { value: "prod", label: "Production" },
            { value: "dev", label: "Development" },
          ],
        }),
      offset: () =>
        p.text({
          message: "Specify an offset to begin importing from.",
          defaultValue: "0",
          placeholder: "0",
        }),
      begin: () =>
        p.confirm({
          message: "Begin Migration?",
          initialValue: true,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Migration cancelled.");
        process.exit(0);
      },
    },
  );

  return args;
};
