import mime from 'mime-types'
import fs from 'fs';
import path from 'path'

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
