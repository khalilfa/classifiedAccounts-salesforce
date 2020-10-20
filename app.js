const fs = require('fs');
const axios = require('axios');

const TOKEN_ENDPOINT = '/admin/oauth/token';
const USERS_ENDPOINT = '/users/ALL/classifieds_accounts/search';
const MELI_ENDPOINT = "https://api.mercadolibre.com";

// File operations
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

const createFile = (fileName, data) => {
    fs.writeFile(fileName, data, err => {
        if (err) console.log('Error al guardar el archivo: ' + err);
        console.log('El archivo se guardo con exito');
    });
}


// API operations
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

const getToken = (credentials) => {
    const ENDPOINT = MELI_ENDPOINT + TOKEN_ENDPOINT;
    const data = axios.post(ENDPOINT, credentials)
        .then(res => res.data)
        .catch(err => console.error(err));
    
    return data;
}

const getAllAccounts = (token, accounts = [], offset = 0, limit = 0) => {
    const ENDPOINT = MELI_ENDPOINT + USERS_ENDPOINT;
    const params = {
        access_token: token.access_token,
        user_type: 'car_dealer, franchise, real_estate_agency',
        offset
    };

    return axios.get(ENDPOINT, { params })
            .then(res => {
                const accountsPage = res.data.results;
                const newOffset = offset + res.data.paging.limit;
                if(accountsPage.length == 0 || limit == 100){
                    return accounts;
                } else {
                    console.log('Se realiza una llamada con cantidad: ' + accountsPage.length);
                    return getAllAccounts(token, accounts.concat(accountsPage), newOffset, newOffset);
                }
                
            })
            .catch(err => console.log(err));
}



// MAIN
const app = () => {
    console.log('Inicia la APP');
    try {
        // READ FILE
        const fileName = getFileName();
        const accounts = readFile(fileName);
        console.log('Cantidad de cuentas: ' + accounts.length);

        // API CONNECTION
        let allAccounts = [];
        const credentials = getCredentials();
        const token = getToken(credentials);
        token
            .then(res => {
                console.log(res);
                getAllAccounts(token)
                    .then(res => {
                        console.log(res.length);
                        const jsonContent = JSON.stringify(res);
                        createFile('recuperados.json', jsonContent);
                    })
                    .catch(err => console.log('-- ERROR: No se pudo realizar la llamada multiple: ' + err));                
            })
            .catch(err => console.error(err));

    } catch (error) {
        console.error(error.message);
    }
}

app();