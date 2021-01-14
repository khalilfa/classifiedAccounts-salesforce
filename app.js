const fs = require('fs');
const path = require("path");
const axios = require('axios');
const moment = require('moment');

const TOKEN_ENDPOINT = '/admin/oauth/token';
const USERS_ENDPOINT = '/users';
const MELI_ENDPOINT = "https://api.mercadolibre.com";

const MAIN_DIR = '/data';
const DATE_DIR = '/' + moment().format("DD-MM-YY");
const ERROR_FILE_NAME = '/Errores.json';
const DATA_FILE_NAME = '/Datos.json';
const RESPONSE_FILE_NAME = '/Respuesta-API.json';
const RESULT_FILE_NAME = '/Resultado.json';

const OPTIONS = {
    EXIST_RESULT_FILE: '-results'
}


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

const createFile = (filePath, data) => {
    fs.writeFile(filePath, data, err => {
        if (err) console.log('\n' + '-- Error al guardar el archivo "' + filePath + '" : ' + err);
        console.log('\n' + 'El archivo "' + filePath + '" se guardo con exito');
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
        throw new Error('\n' + '-- ERROR: No se pudo leer el archivo de credenciales: ' + credentialsFileName);
    }
}

const getToken = (credentials) => {
    const ENDPOINT = MELI_ENDPOINT + TOKEN_ENDPOINT;
    const data = axios.post(ENDPOINT, credentials)
        .then(res => res.data)
        .catch(err => console.error(err));
    
    return data;
}

const getAllAccountsFromAPI = (token, accountIds, limit = 20, offset = 0, gettedAccounts = []) => {
    const ENDPOINT = MELI_ENDPOINT + USERS_ENDPOINT;
    const newOffset = offset + limit;
    const params = {
        access_token: token,
        ids: accountIds.slice(offset, newOffset).toString()
    };

    if(offset == 0) console.log('-- Cantidad de elementos recuperados de la API:  ');

    return axios.get(ENDPOINT, { params })
            .then(res => {
                const newAccounts = res.data.map(elem => elem.body);

                if((offset % 1000) == 0 && offset != 0) console.log('- ' + offset);

                if(newAccounts.length < limit) {
                    gettedAccounts.push(...newAccounts);

                    console.log('- ' + gettedAccounts.length);
                    
                    return gettedAccounts;
                } else {
                    gettedAccounts.push(...newAccounts);
                    return getAllAccountsFromAPI(token, accountIds, limit, newOffset, gettedAccounts);
                }
            })
            .catch(err => console.log(err));
}


const getAllAccounts20Async = (token, accountIds, limit = 1, offset = 0, gettedAccounts = []) => {
    const ENDPOINT = MELI_ENDPOINT + USERS_ENDPOINT;

    const sublists = sliceList(accountIds);

    return Promise.all(sublists.map(sublist => {
        return axios.get(ENDPOINT, { params: { access_token: token, ids: sublist.toString() } })
                    .then(res => res.data.map(elem => elem.body))
                    .catch(err => console.error('-- Error al recuperar una cuenta: ' + err));
    }));
}

const sliceList = (list) => {
    let index = 0;
    const result = [];
    let slicedList;
    while(index < list.length){
        slicedList = list.slice(index, index + 20);
        result.push(slicedList);
        index = index + 20;
    }

    return result;
}

// Data transformation logic
const createNewAccounts = (data) => {
    const updatedAccounts = [];
    data.forEach(account => {
        try {
            const allowedToList = account.status.list.allow && account.internal_tags.length == 0;
            const allowedToSell = account.status.sell.allow && account.internal_tags.length == 0;
            updatedAccounts.push({
                Cust_Id__c: account.id,
                Name: account.nickname,
                Razon_Social__c: account.company.corporate_name,
                N_de_CUIT__c: account.company.identification,
                Pa_s__c: account.site_id,
                BillingStreet: account.address.address,
                BillingCity: account.address.city,
                BillingPostalCode: account.address.zip_code,
                BillingCountryCode: account.country_id,
                BillingStateCode: ((account.address.state != null) && (account.address.state.indexOf('-') > 0)) ? account.address.state.substring(account.address.state.indexOf('-') + 1) : account.address.state,
                Unique_Nickname__c: account.site_id+'_N-'+account.nickname+'-N',
                Estado_del_Vendedor__c: account.status.site_status,
                Identification_Type__c: account.identification.type,
                Identification_Number__c: account.identification.number,
                Immediate_Payment__c: account.status.immediate_payment == 'true',
                User_Type__c: account.user_type,
                Credit_Consumed__c: account.credit.consumed,
                Credit_Level_Id__c: account.credit.credit_level_id,
                Allowed_to_List__c: allowedToList,
                Allowed_to_Sell__c: allowedToSell,
                List_Error_Codes__c: allowedToList ? '' : [...account.status.list.codes, ...account.internal_tags].join(';'),
                Sell_Error_Codes__c: allowedToSell ? '' : [...account.status.sell.codes, ...account.internal_tags].join(';'),
                Tags__c: account.tags ? account.tags.join(';') : '',
            });
        } catch(err) {
            console.log('-- Error al crear las cuentas: ' + err);
        }
        
    });
    return updatedAccounts;
}

getAllAccountIds = (accounts) => accounts.map(acc => acc.Cust_ID__c);

// OPTIONS
const getOptions = () => {
    const options = process.argv.slice(2);
    return options;
}

existResultFile = () => {
    return getOptions().includes(OPTIONS.EXIST_RESULT_FILE);
}

// MAIN
const app = () => {
    console.log('--- Inicia el script ---' + '\n');
    try {
        if(!existResultFile()) {
            // Create a directories if they don't exist
            const currentPath = path.join(__dirname, MAIN_DIR);
            if (!fs.existsSync(currentPath)) fs.mkdirSync(currentPath);
            if (!fs.existsSync(currentPath + DATE_DIR)) fs.mkdirSync(currentPath + DATE_DIR);
            
            // Move file to the correct directory. If there is a file, then move it
            const originalFilePath = __dirname + '/' + getFileName();
            const newFilePath = currentPath + DATE_DIR + DATA_FILE_NAME;
            if (fs.existsSync(originalFilePath)) fs.renameSync(originalFilePath, newFilePath);

            // READ FILE
            const accounts = readFile(!fs.existsSync(originalFilePath) ? newFilePath : originalFilePath);
            console.log('Cantidad de cuentas en el archivo "' + getFileName() + '": ' + accounts.length + '\n');

            // API CONNECTION
            const credentials = getCredentials();
            const token = getToken(credentials);
            token.then(res => {
                const accountIds = getAllAccountIds(accounts);
                
                let action = process.argv.includes('sync') ? getAllAccountsFromAPI : getAllAccounts20Async;
                action(res.access_token, accountIds)
                    .then(accs => {               
                        // Create a response file
                        const responseFilePath = __dirname + MAIN_DIR + DATE_DIR + RESPONSE_FILE_NAME;
                        const responseContent = JSON.stringify(accs);
                        createFile(responseFilePath, responseContent);

                        return accs;
                    })
                    .catch(err => console.log('\n' + '-- ERROR: No se pudo realizar la llamada multiple: ' + err))
                    .then(accs => {
                        // Transform data
                        let accsToProcess = process.argv.includes('sync') ? accs : accs.flat();
                        const newAccounts = createNewAccounts(accsToProcess);

                        // CREATE OUTPUT FILE
                        const resultFilePath = __dirname + MAIN_DIR + DATE_DIR + RESULT_FILE_NAME;
                        const resultContent = JSON.stringify(newAccounts);
                        createFile(resultFilePath, resultContent);
                    })
                    .catch(err => console.log('\n' + '-- ERROR: No se pudo realizar transformar la data recuperada: ' + err))
                    .then(() => {
                        // END
                        setTimeout(function(){ console.log('\n' + '-- Finalizo la ejecucion --' + '\n'); }, 1000);
                    });
            })
            .catch(err => console.error(err));
        } else {
            // Read today response file
            const responseFileName = __dirname + MAIN_DIR + DATE_DIR + RESPONSE_FILE_NAME;
            const accs = readFile(responseFileName);
            console.log('Cantidad de cuentas en el archivo "' + responseFileName + '": ' + accs.length + '\n');

            // Transform data
            const newAccounts = createNewAccounts(accs);

            // Modify result file
            const resultFileName = __dirname + MAIN_DIR + DATE_DIR + RESULT_FILE_NAME;
            const resultContent = JSON.stringify(newAccounts);
            createFile(resultFileName, resultContent);

            // END
            setTimeout(function(){ console.log('\n' + '-- Finalizo la ejecucion --' + '\n'); }, 1000);
        }
        

    } catch (error) {
        console.error(error.message);
    }
}

app();