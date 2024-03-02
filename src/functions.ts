import mime from 'mime-types'
import fs from 'fs';
import path from 'path'
import csvParser from 'csv-parser';


const createFilePath = (file: string) => {
  return path.join(__dirname, '..', file)
}

export const checkIfFileExists = (file: string) => {
  console.log('file', file)

  if (fs.existsSync(createFilePath(file))) {
    console.log('exist')
    return true
  }
  else {
    console.log('does not exist')
    return false
  }
}

export const getFileType = (file: string) => {
  return mime.lookup(createFilePath(file))
}


export const loadUsersFromFile = async (file: string) => {

  const type = getFileType(createFilePath(file))
  if (type === "text/csv") {

    const users = [{}];
    return new Promise((resolve, reject) => {
      fs.createReadStream(createFilePath(file))
        .pipe(csvParser())
        .on('data', (data) => users.push(data))
        .on('error', (err) => reject(err))
        .on('end', () => {
          resolve(users)
        })
    });
  } else {

    // TODO: Can we deal with the any here?
    const users: any[] = JSON.parse(
      fs.readFileSync(createFilePath(file), "utf-8")
    );

    return users
  }

}

