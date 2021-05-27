const logger = require('lambda-log');
const axios = require('axios');

// Amdoc Environment Variables
let { AMDOC_QUERY_URL, AMDOC_CREATE_URL, AMDOC_UPDATE_URL, AMDOC_SECRET} = process.env;

class AMDOC {
    
    corpid;
    partnerid;
    transactionid;
    referenceticketnumber;
    status;
    notes;
    attachments;
    customerreferencenumber;
    customerentitlementcode;
    clientname;
    description;
    companyname;
    primarycontactfirstname;
    primarycontactlastname;
    email;
    primarycontacttelephonenumber;
    street;
    steet2;
    city;
    state;
    zip;
    serialnumber;
    modelnumber;


    constructor(corpid, partnerid, transactionid, referenceticketnumber, status, notes, attachments, customerreferencenumber, customerentitlementcode, clientname, description, companyname, primarycontactfirstname, primarycontactlastname, email, primarycontacttelephonenumber, street, steet2, city, state, zip, serialnumber, modelnumber) {
        this.corpid = corpid;
        this.partnerid = partnerid;
        this.transactionid = transactionid;
        this.referenceticketnumber = referenceticketnumber;
        this.status = status;
        this.notes = notes;
        this.attachments = attachments;
        this.customerreferencenumber = customerreferencenumber;
        this.customerentitlementcode = customerentitlementcode;
        this.clientname = clientname;
        this.description = description;
        this.companyname = companyname;
        this.primarycontactfirstname = primarycontactfirstname;
        this.primarycontactlastname = primarycontactlastname;
        this.email = email;
        this.primarycontacttelephonenumber = primarycontacttelephonenumber;
        this.street = street;
        this.steet2 = steet2;
        this.city = city;
        this.state = state;
        this.zip = zip;
        this.serialnumber = serialnumber;
        this.modelnumber = modelnumber;
    }
    
}


module.exports.getAWSSecret = async (event, context) => {

// Load the AWS SDK
var AWS = require('aws-sdk'),
    region = "us-east-2",
    secretName = AMDOC_SECRET,
    secret,
    decodedBinarySecret;

// Create a Secrets Manager client
var client = new AWS.SecretsManager({
    region: region
});


   client.getSecretValue({ SecretId: secretName }, async function (err, data) {
    if (err) {
        if (err.code === 'DecryptionFailureException')
            // Secrets Manager can't decrypt the protected secret text using the provided KMS key.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        else if (err.code === 'InternalServiceErrorException')
            // An error occurred on the server side.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        else if (err.code === 'InvalidParameterException')
            // You provided an invalid value for a parameter.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        else if (err.code === 'InvalidRequestException')
            // You provided a parameter value that is not valid for the current state of the resource.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
        else if (err.code === 'ResourceNotFoundException')
            // We can't find the resource that you asked for.
            // Deal with the exception here, and/or rethrow at your discretion.
            throw err;
    }
    else {
        // Decrypts secret using the associated KMS CMK.
        // Depending on whether the secret is a string or binary, one of these fields will be populated.
        if ('SecretString' in data) {
            secret = data.SecretString;

        } else {
            let buff = new Buffer(data.SecretBinary, 'base64');
            decodedBinarySecret = buff.toString('ascii');
        }
    }


});


    try {
        const data = await client.getSecretValue({
            SecretId: secretName,
        }).promise();

        if (data) {
            if (data.SecretString) {
                const secret = data.SecretString;
                const parsedSecret = JSON.parse(secret);
                return {
                    secrets: parsedSecret,
                };
            }

            const binarySecretData = data.SecretBinary;
            return binarySecretData;
        }
    } catch (error) {
        logger.info('Error retrieving AMDOC secrets');
        logger.info(error);
    }
    


}



module.exports.buildAMDOC = async (parsedEmail, rule, email) => {
    
    let emailBody = parsedEmail.text;
    let allFields = rule[0].allFields;


    //Converts the Email Body to JSON for comparing
    let emailJSON = await convertEmailToJSON(emailBody);
  
    try {
        const amdoc = new AMDOC(
        )

        allFields.map((key) => {
            key = trim(key);
            if (emailJSON[key]) {
                amdoc[key] = emailJSON[key]
            }
        })

        if (email.attachments.length != 0) {
            amdoc['attachments'] = email.attachments
        }


        logger.info('Built the parsed AMDOC object');
        return amdoc;

    } catch (error) {
        logger.error('Failed to parse email:', error);
        throw error;
    }
}



module.exports.buildUpdateAMDOC = async (parsedEmail, rule, email, referenceTicketPrefix) => {

    let emailBody = parsedEmail.text;
    let updateFields = rule[0].updateFields;


    //Converts the Email Body to JSON for comparing
    let emailJSON = await convertEmailToJSON(emailBody);

    try {
        const updateAmdoc = new AMDOC(
        )

        updateFields.map((key) => {
            key = trim(key);
            if (emailJSON[key]) {
                updateAmdoc[key] = emailJSON[key]
            }
        })

        //Checks for attachments and adds to update object
        if (email.attachments.length != 0) {
            updateAmdoc['attachments'] = email.attachments
        }

        //Parses ticketnumber in email subject if present
        if (email.subject.toUpperCase().indexOf(referenceTicketPrefix.toUpperCase()) != -1) {

            const ticketRegex = new RegExp(`(${referenceTicketPrefix.toLowerCase()}+[\\S]*)`);
            let ticketNumber = getMatching(email.subject.toLowerCase(), ticketRegex )
            updateAmdoc['referenceticketnumber'] = ticketNumber

        }


        logger.info('Built the parsed Update AMDOC object');
        return updateAmdoc;

    } catch (error) {
        logger.error('Failed to parse email during update:', error);
        throw error;
    }
}


module.exports.checkAMDOCFields = (amdoc, rule) => {

    let requiredFields = rule[0].required;
    let checkValue = true;

    // Checks the AMDOC object for required fields
    for (num in requiredFields) {

        key = trim(requiredFields[num]);

        if (!amdoc[key]) {
            logger.info('Required Field Missing: ', requiredFields[num]);

            checkValue = false;
        }
    }
    return checkValue;
}



function convertEmailToJSON(emailBody) {
    //Converts the Email body to a usable JSON object
    const emailBodyArray = emailBody.split('\n').map(item => item.trim());
    let emailJSONArray = new Array();

    for (num in emailBodyArray) {
       
        let arrayValues = emailBodyArray[num].split(':');
        let arrayString = '"' + trim(arrayValues[0]) + '"' + ':' + '"' + arrayValues[1] + '"';
        emailJSONArray.push(arrayString);
     
    };  

    let jsonDataString = '{' + emailJSONArray.toString() + '}';
    let emailJSON = JSON.parse(jsonDataString);

    return emailJSON;
}



function trim(input) {
    //Removes spaces and makes input lowercase
    let output = input.replace(/\s+/g, '').toLowerCase();

    return output;
}


module.exports.createAmdocsCase = async (amdoc, amdoc_creds) => {

    logger.info('***** Create AMDOC API CALL REACHED *****');

    //Sets current timestamp in ISO 8601 standard
    let timestamp = new Date();
    timestamp = timestamp.toISOString();
    timestamp = timestamp.replace(/\.[0-9]{3}/, '');


    // Creates the API JSON data from the react AMDOC component
    let amdocJSON = {
        sender: "EGN",
        receiver: "CCC",
        client: amdoc.partnerid,
        transactionId: amdoc.transactionid,
        transactionDt: timestamp,
        data: {
            ticketInfo: {
                refTicketNumber: amdoc.customerreferencenumber,
                additionalRefNumbers: [{
                    entity: "3rdParty",
                    number: amdoc.customerreferencenumber
                }],
                openDateStamp: timestamp,
                sentDateStamp: timestamp,
                transDateStamp: timestamp,
                problemDescription: amdoc.description,
                entitlement: {
                    code: amdoc.customerentitlementcode
                }
            },
            contacts: [{
                type: "primary",
                company: amdoc.companyname,
                firstName: amdoc.primarycontactfirstname,
                lastName: amdoc.primarycontactlastname,
                email: amdoc.email,
                phone: amdoc.primarycontacttelephonenumber
            }],
            serviceAddress: {
                street: [amdoc.street, amdoc.street2],
                city: amdoc.city,
                state: amdoc.state,
                zip: amdoc.zip
            },
            equipment: [{
                model: amdoc.modelnumber ? amdoc.modelnumber : "UNKNOWN",
                serial: amdoc.serialnumber ? amdoc.serialnumber : "UNKNOWN",
                description: amdoc.description
            }],
            notes: [{
                text: amdoc.notes ? amdoc.notes : null,
            }],
            
        } 
    }

    if (amdoc.attachments) {
        amdocJSON['attachments'] = amdoc.attachments
    }


    await axios.post(AMDOC_CREATE_URL, amdocJSON, {
        auth: {
            username: amdoc_creds.secrets.AMDOC_USER,
            password: amdoc_creds.secrets.AMDOC_PASS
        },

    }).then((response) => {
        logger.info('***** API Call Response *****');
        logger.info(response);
        console.log(response);
        logger.info('***** API Call Response  *****');
    }, (error) => {
        logger.info('***** API Call ERROR!  *****');
        logger.info(error);
        console.log(error);
        logger.info('*****  API Call ERROR! *****');
    });   

}





module.exports.updateAmdocsCase = async (amdoc, amdoc_creds) => {

    logger.info('***** Update AMDOC API CALL REACHED *****');

    let update_url = AMDOC_UPDATE_URL + amdoc.referenceticketnumber

    //Sets current timestamp in ISO 8601 standard
    let timestamp = new Date();
    timestamp = timestamp.toISOString();
    timestamp = timestamp.replace(/\.[0-9]{3}/, '');

    // Creates the API JSON data from the update AMDOC component
    let updateJSON = {
        sender: "EGN",
        receiver: "CCC",
        client: amdoc.partnerid,
        transactionId: amdoc.transactionid,
        transactionDt: timestamp,
        data: {
            ticketInfo: {
                refTicketNumber: amdoc.referenceticketnumber,
                sentDateStamp: timestamp,
                transDateStamp: timestamp,
                status: amdoc.status,
                notes: [{
                    text: amdoc.notes ? amdoc.notes : null,
                }],
                
            },
           
        }
    }

    if (amdoc.attachments) {
        updateJSON.data.ticketInfo['attachments'] = amdoc.attachments
    }
 
    await axios.post(update_url, updateJSON, {
        auth: {
            username: amdoc_creds.secrets.AMDOC_USER,
            password: amdoc_creds.secrets.AMDOC_PASS
        },

    }).then((response) => {
        logger.info('***** API Call Response *****');
        logger.info(response);
        console.log(response);
        logger.info('***** API Call Response  *****');
    }, (error) => {
        logger.info('***** API Call ERROR!  *****');
        logger.info(error);
        console.log(error);
        logger.info('*****  API Call ERROR! *****');
    });


}



function getMatching(string, regex) {
    // Helper function when using non-matching groups
    const matches = string.match(regex);
    if (!matches || matches.length < 2) {
        return null;
    }
    return matches[1];
}