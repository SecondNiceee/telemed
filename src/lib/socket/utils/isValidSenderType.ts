// Проверка (Type Guard) что типо отправителя является либо 'user' либо 'doctor'
export default function isValidSenderType(senderType: unknown): senderType is 'user' | 'doctor' | undefined {
    return senderType === undefined || senderType === 'user' || senderType === 'doctor'
  }
  