import fs from 'fs';
import path from 'path'

const confirmOrCreateFolder = (path: string) => {
  console.log('creating', path)
  try {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
  } catch (err) {
    console.error(err);
  }

}

export const logger = (type: "info" | "error" | "validator", payload: any, dateTime: string): void => {

  confirmOrCreateFolder(path.join(__dirname, '..', 'logs'))
  console.log(type)


  if (type === "info") {
    const infoPath = path.join(__dirname, '..', 'logs', 'info')

    confirmOrCreateFolder(infoPath)

    fs.appendFileSync(
      `${infoPath}/${dateTime}.json`,
      `\n${JSON.stringify(payload, null, 2)}`
    );
  }

  if (type === "error") {
    const errorsPath = path.join(__dirname, '..', 'logs', 'errors')
    console.log(errorsPath)
    confirmOrCreateFolder(errorsPath)



    fs.appendFileSync(
      `${errorsPath}/${dateTime}.json`,
      `\n${JSON.stringify(payload, null, 2)}`
    );

  }


  if (type === "validator") {
    const validatorPath = path.join(__dirname, '..', 'logs', 'validator')
    confirmOrCreateFolder(validatorPath)



    fs.appendFileSync(
      `${validatorPath}/${dateTime}.json`,
      `\n${JSON.stringify(payload, null, 2)}`
    );

  }


}
