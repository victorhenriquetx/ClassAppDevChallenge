const fs = require('fs');
const _ = require('lodash');
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

//Remove o header 'class' duplicado e une os dados do header 'class' em um mesmo vetor 
const removeDoubles = (headers, userData) => {
  let classIndexes = [];
  let firstClassIndex;
  let doubledClassIndex;
  
  headers.forEach((header, index) => {
    if(header === 'class') classIndexes.push(index);
  });
  firstClassIndex = _.head(classIndexes);
  doubledClassIndex = _.tail(classIndexes);
  headers.splice(doubledClassIndex,1);
  userData.forEach((element, index) => {
    let classArr = [];
    let regex = /Sala [0-9]/gm;
    let firstClasses = element[firstClassIndex].match(regex);
    let otherClasses = element[doubledClassIndex].match(regex);
    
    if (firstClasses)classArr = firstClasses;
    if (otherClasses)classArr = _.union(classArr,otherClasses);

    element.splice(doubledClassIndex,1);
    element[firstClassIndex] = classArr;
  });
  return headers, userData;
}

const searchAddress = (user, value) => {
  let addrIndex = -1;
  user.addresses.forEach ((element, index) => {
    if (element.address === value) addrIndex = index;
  });
  return addrIndex;
}

const isValidEmail = (value) => {
  if(isNaN(value) && value.search('@.') > 0 && value.split(' ').length <= 1) return true;
  else return false;
}

const isValidPhoneNumber = (value) => {
  value = value.replace(/[( )]/g, '');
  if(!isNaN(value) && value !== ''){
    let phone = phoneUtil.parseAndKeepRawInput(value, 'BR');
    
    if(phoneUtil.isValidNumber(phone) && phoneUtil.isPossibleNumber(phone)){
      phone = phoneUtil.format(phone, PNF.E164).split('+')[1];
      return phone;
    }
  }
  return null;
}

//Retorna um usuário com uma nova propriedade de endereços com os enderços de email e telefone verificados e corrigidos
const fixAddresses = (user) => {
  let keys = _.keys(user);
  user.addresses = [];

  keys.forEach((key) => {
    if(key.includes('email')|| key.includes('phone')){
      let headers = key.replace(/['"]+/g, '').split(/[ ,]+/);
      let values = user[key].split(/[/]/);
      const tail = ([, ...t]) => t;

      values.forEach((value) => {
        let isValid;

        if(headers[0] === 'email') isValid = isValidEmail(value);
        else if (headers[0] === 'phone'){
          value = isValidPhoneNumber(value);
          isValid = (value? true : false);
        }
        if(isValid){     
          let addrIndex = searchAddress(user,value);
          if (addrIndex > -1){
            let obj = user.addresses[addrIndex];
            obj.tags = obj.tags.concat(tail(headers));
          }else{
            let obj = {
              type : headers[0],
              tags : tail(headers),
              address: value
            };
            user.addresses.push(obj);
          }
        }
      });
    }
  });
  return user;
}

const searchUser = (users,eid) => {
  let userIndex = -1;
  users.forEach((element, index) => {
    if(element.eid === eid) userIndex = index;
  });
  return userIndex;
}

const fixFlag = (flag) => {
  if(flag === '' || flag === 'no' || flag == 0)
    return false;
  else return true;
}

//Verifica se existe um usuário de mesmo 'eid' e une os dados correspondentes se for o caso, e retorna um Array de usuários com as propriedades de endereço e as flags corrigidas
const createUsers = (dataArray) => {
  let users = [];

  dataArray.forEach((element, index) => {
    element = fixAddresses(element);
    let userIndex = searchUser(users,element.eid);
    if(userIndex > -1){
      let obj = users[userIndex];
      obj.classes = obj.classes.concat(element.class);
      obj.addresses = obj.addresses.concat(element.addresses);
      obj.invisible = ((element.invisible === '')? obj.invisible: fixFlag(element.invisible));
      obj.see_all = ((element.see_all === '')? obj.see_all: fixFlag(element.see_all));
    }else{
      let obj = {
        fullname: element.fullname,
        eid: element.eid,
        classes: element.class,
        addresses: element.addresses,
        invisible: fixFlag(element.invisible),
        see_all: fixFlag(element.see_all)
      }
      users.push(obj);
    }
  });
  return users;
}



const parseData = (data) => {
  let splitData = data.split("\n");
  let userData = [];
  let regex = /"[^"]*"|[^,]+/g;
  let regexData = /(?!\B"[^"]*),(?![^"]*"\B)/g;
  let headers = splitData.shift().match(regex);
  let dataArray = [];
  let userArray;

  splitData.forEach((element, index) => {
    userData.push(element);
    userData[index] = userData[index].split(regexData);
  });
  
  headers, userData = removeDoubles(headers, userData);
  
  userData.forEach((element) => {
    dataArray.push(_.zipObject(headers, element));
  });
  userArray = createUsers(dataArray);
  return userArray;
}

const readDataCallback = (err, data) => {
  if (err) console.log(err);
  else {
    let users = parseData(data);
    fs.writeFile('output.json', JSON.stringify(users, null, '  '), (err)=> {
      if(err) console.log(err);
    });
  }
}

fs.readFile('input.csv', 'utf-8', readDataCallback);