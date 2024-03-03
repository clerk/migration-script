import fs from 'fs';

export const logger = (type: "info" | "error" | "validation", payload: any, dateTime: string): void => {

  console.log(type)


  if (type === "info") {

    fs.appendFileSync(
      `./logs/info/${dateTime}.json`,
      `\n${JSON.stringify(payload, null, 2)}`
    );
  }

  if (type === "error") {
    fs.appendFileSync(
      `./logs/errors/${dateTime}.json`,
      `\n${JSON.stringify(payload, null, 2)}`
    );

  }

}
