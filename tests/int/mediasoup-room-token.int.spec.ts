import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { signRoomToken, verifyRoomToken } from '../../src/lib/mediasoup/room-token'

const SECRET = 'test-mediasoup-secret-with-at-least-32-characters'

describe('MediaSoup room tokens', () => {
  beforeEach(() => {
    process.env.MEDIASOUP_SERVER_SECRET = SECRET
  })

  afterEach(() => {
    delete process.env.MEDIASOUP_SERVER_SECRET
  })

  it('signs and verifies a token bound to a room and peer', () => {
    const token = signRoomToken({
      appointmentId: 42,
      roomId: 'appointment_42',
      peerId: 'doctor-7',
      userId: '7',
      role: 'doctor',
      peerName: 'Doctor',
    })

    const claims = verifyRoomToken(token, { roomId: 'appointment_42', peerId: 'doctor-7' })
    expect(claims.appointmentId).toBe(42)
    expect(claims.role).toBe('doctor')
  })

  it('rejects a token for another room or peer', () => {
    const token = signRoomToken({
      appointmentId: 42,
      roomId: 'appointment_42',
      peerId: 'patient-9',
      userId: '9',
      role: 'patient',
      peerName: 'Patient',
    })

    expect(() => verifyRoomToken(token, { roomId: 'appointment_43' })).toThrow()
    expect(() => verifyRoomToken(token, { peerId: 'patient-10' })).toThrow()
  })

  it('rejects expired tokens', () => {
    const token = jwt.sign(
      {
        purpose: 'mediasoup-room',
        appointmentId: 42,
        roomId: 'appointment_42',
        peerId: 'doctor-7',
        userId: '7',
        role: 'doctor',
        peerName: 'Doctor',
        exp: Math.floor(Date.now() / 1000) - 1,
      },
      SECRET,
      { algorithm: 'HS256' },
    )

    expect(() => verifyRoomToken(token)).toThrow()
  })
})
