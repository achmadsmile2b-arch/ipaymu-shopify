import fetch from 'node-fetch'; // npm install crypto-js
import CryptoJS from 'crypto-js'; // npm install node-fetch --save

// adjust with your iPaymu api key & va 
var apikey          = "95489E50-3167-4B04-AA4D-D01732200BB6";
var va              = "1179003819651945";
//var url             = 'https://sandbox.ipaymu.com/api/v2/payment/direct'; // development mode
 var url             = 'https://my.ipaymu.com/api/v2/payment/direct'; // for production mode

var body            = {
    "name":"Putu",
    "phone":"08123456789",
    "email": "putu@gmail.com",
    "amount": 10000,
    "8comments":"Payment to Arkeb Store",
    "notifyUrl":"https://webhook.site/55b46c9a-c93d-492a-86d9-206aa1a9292d", // your callback url
    "returnUrl": "http://arkebstore.myshopify.com/pages/payment-success",
    "cancelUrl": "http://arkebstore.myshopify.com/pages/payment-cancel",
    "referenceId":"1234", // your reference id or transaction id
    "paymentMethod":"va",
    "paymentChannel":"bca",
} 
// generate signature
var bodyEncrypt     = CryptoJS.SHA256(JSON.stringify(body));
var stringtosign    = "POST:"+va+":"+bodyEncrypt+":"+apikey;
var signature       = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(stringtosign, apikey));
// request
fetch(
    url,
    {
        method: "POST",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            va: va,
            signature: signature,
            timestamp: '20150201121045'
        },
        body: JSON.stringify(body)
    }
)
.then((response) => response.json())
.then((responseJson) => {
    // response
    console.log(responseJson)
})
