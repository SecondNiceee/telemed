// Проверка (Type Guard) что тип отправителя является либо 'user' либо 'doctor'
// preferredSenderType теперь ОБЯЗАТЕЛЕН - undefined не допускается
export default function isValidSenderType(senderType: unknown): senderType is 'user' | 'doctor' {
    return senderType === 'user' || senderType === 'doctor'
  }
  
