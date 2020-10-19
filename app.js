const fs = require('fs');

const getFileName = () => {
    if (process.argv[2]) {
        const fileName = process.argv[2];
        return fileName;
    } else {
        throw new Error('-- ERROR: No se ingreso el nombre del archivo por parametros');
    }
}

const readFile = (fileName) => {
    try {
        let data = fs.readFileSync(fileName);
        let accounts = JSON.parse(data);

        return accounts;
    } catch (error) {
        throw new Error('-- ERROR: No se pudo leer el archivo: ' + error.message);
    }
}

const getCredentials = () => {
    const credentialsFileName = 'meli_creds_admin.json';
    try {
        let data = fs.readFileSync(credentialsFileName);
        let credentials = JSON.parse(data);

        return credentials;
    } catch (error) {
        throw new Error('-- ERROR: No se pudo leer el archivo de credenciales: ' + credentialsFileName);
    }
}

const app = () => {
    console.log('Inicia la APP');
    try {
        // READ FILE
        const fileName = getFileName();
        const accounts = readFile(fileName);
        console.log('Cantidad de cuentas: ' + accounts.length);

        // API CONNECTION
        const credentials = getCredentials();

    } catch (error) {
        console.error(error.message);
    }
}

app();