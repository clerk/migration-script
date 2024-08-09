let csvToJson = require('convert-csv-to-json');

let fileInputName = 'users.csv'; 
let fileOutputName = 'users.json';

csvToJson.supportQuotedField(true).fieldDelimiter(',').formatValueByType().generateJsonFileFromCsv(fileInputName,fileOutputName);