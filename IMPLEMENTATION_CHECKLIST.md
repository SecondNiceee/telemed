# MediaSoup Server-Side Recording - Implementation Checklist

## ✅ Code Changes (Completed)

- [x] **src/lib/mediasoup/recorder.ts**
  - [x] Added `appointmentId: number | null` to `RecordingSession` interface
  - [x] Added `recordingType: 'video' | 'audio'` to `RecordingSession` interface
  - [x] Updated `startRecording()` signature to accept `appointmentId` and `recordingType`
  - [x] Updated session creation to store both parameters

- [x] **src/mediasoup-server.ts**
  - [x] Updated `start-recording` handler to:
    - Extract `appointmentId` from `roomId` (format: `appointment_123`)
    - Validate appointment ID format
    - Pass `appointmentId` and `recordingType` to recorder
  - [x] Updated `stop-recording` handler to:
    - Extract `appointmentId` from session
    - Call `/api/mediasoup-recording/finalize-server` (server-to-server)
    - Pass `serverSecret` instead of JWT
    - Handle success/error responses
    - Emit `recording-stopped` with `finalized` and `recordingId`

- [x] **src/components/video-call/hooks/use-mediasoup-connection.ts**
  - [x] Updated `UseMediasoupConnectionOptions` types
  - [x] Updated `onRecordingStopped` callback signature
  - [x] Updated `recording-stopped` event handler
  - [x] Updated `startRecording()` method to accept `recordingType`

- [x] **src/components/video-call/video-call-provider-mediasoup.tsx**
  - [x] Simplified `onRecordingStopped` handler (removed client-side finalization)
  - [x] Updated toast messages to show server finalization status
  - [x] Updated `startServerRecording()` to support `recordingType`
  - [x] Updated context type definitions

## 🔧 Configuration Required

### Environment Variables

**BEFORE using the app, you MUST set these:**

- [ ] `NEXTJS_URL` - Set to your Next.js server URL
  ```bash
  # Development
  NEXTJS_URL=http://localhost:3000
  
  # Production
  NEXTJS_URL=https://your-domain.com
  ```

- [ ] `MEDIASOUP_SERVER_SECRET` - Generate a secure secret
  ```bash
  # Generate secure secret (run this once)
  openssl rand -base64 32
  
  # Example output: aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890=
  
  # Set in .env.local:
  MEDIASOUP_SERVER_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890=
  ```

**Where to set:**
- [ ] Development: `.env.local` in project root
- [ ] Production: Vercel Settings → Environment Variables

### Directory Setup

- [ ] Verify `/tmp/mediasoup-recordings/` directory exists
  ```bash
  mkdir -p /tmp/mediasoup-recordings
  chmod 755 /tmp/mediasoup-recordings
  ```

## 📋 Testing Checklist

### Test 1: Normal Recording Completion ✅

- [ ] Start dev server: `pnpm dev`
- [ ] Open two browsers (different doctors in same room)
- [ ] Click "Start Recording"
- [ ] Speak for ~5 minutes
- [ ] Click "Stop Recording"
- [ ] Verify:
  - [ ] Toast message: "Запись консультации сохранена" (green)
  - [ ] Server logs contain: `[MediaSoup] Recording finalized successfully: recordingId=XXX`
  - [ ] Payload CMS: `appointment.recording` is populated
  - [ ] File deleted from `/tmp/mediasoup-recordings/`

### Test 2: Browser Close (Failsafe) ⚠️

**IMPORTANT: This tests the most critical scenario**

- [ ] Start recording (same as Test 1)
- [ ] Speak for ~5 minutes
- [ ] ❌ **CLOSE THE BROWSER** (don't click "Stop Recording")
- [ ] Check other browser sees: "Запись остановлена (врач отключился)"
- [ ] Verify:
  - [ ] Server logs show automatic finalization
  - [ ] Recording still saved to Payload CMS
  - [ ] No data loss!

### Test 3: Audio-Only Recording

- [ ] Create audio-only call (or modify `recordingType`)
- [ ] Start recording with `recordingType: 'audio'`
- [ ] Speak for ~2 minutes
- [ ] Stop recording
- [ ] Verify:
  - [ ] File size is smaller (~0.1-0.2 MB/min vs 1-2 MB/min for video)
  - [ ] Payload CMS: `CallRecording.recordingType = 'audio'`

### Test 4: Network Error During Finalization

- [ ] Start recording
- [ ] Speak for ~3 minutes
- [ ] Open DevTools → Network tab → Offline
- [ ] Click "Stop Recording"
- [ ] Verify:
  - [ ] Toast message: "Не удалось сохранить запись" (red)
  - [ ] File still in `/tmp/mediasoup-recordings/`
  - [ ] Server logs show finalization error
- [ ] Go Online in DevTools
- [ ] Manually call finalize API (see DEBUGGING section below)

## 🔍 Debugging

### Check if variables are set

```bash
echo "NEXTJS_URL=$NEXTJS_URL"
echo "MEDIASOUP_SERVER_SECRET=$MEDIASOUP_SERVER_SECRET"
```

### Monitor recording files

```bash
# Terminal 1: Watch recording directory
watch 'ls -lh /tmp/mediasoup-recordings/'

# Terminal 2: Run dev server
pnpm dev
```

### Check logs for finalization

```bash
# Look for these in your dev server logs:
[MediaSoup] Recording finalized successfully: recordingId=XXX
[MediaSoupRecording/FinalizeServer] Recording file found
[MediaSoupRecording/FinalizeServer] Media uploaded, ID: XXX
```

### Manually test finalize API

```bash
curl -X POST http://localhost:3000/api/mediasoup-recording/finalize-server \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": 123,
    "sessionId": "appointment_123-test",
    "durationSeconds": 60,
    "recordingType": "video",
    "serverSecret": "your-secret-key-here"
  }'
```

Expected response:
```json
{
  "success": true,
  "recordingId": 456,
  "mediaId": 789
}
```

## 🚀 Production Checklist

Before deploying to production:

- [ ] Set `NEXTJS_URL` to your production domain
- [ ] Generate new `MEDIASOUP_SERVER_SECRET` using: `openssl rand -base64 32`
- [ ] Add both to Vercel Environment Variables
- [ ] Test in staging environment first
- [ ] Run all 4 test scenarios in staging
- [ ] Monitor logs for any errors
- [ ] Have rollback plan ready

## 📝 Documentation

- [x] Created `MEDIASOUP_RECORDING_FIX.md` - Complete technical documentation
- [x] Created `IMPLEMENTATION_SUMMARY.md` - Summary of all changes
- [x] Created `IMPLEMENTATION_CHECKLIST.md` - This file

## 🐛 Known Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Recording file not found" error | Check `/tmp/mediasoup-recordings/` exists and has write permissions |
| "serverSecret verification failed" | Ensure `MEDIASOUP_SERVER_SECRET` is same in both .env files |
| "NEXTJS_URL not reachable" | Verify MediaSoup server can reach Next.js (check firewall, ports) |
| Recording not showing in CMS | Check appointment.id in database, verify relationship |
| File stuck in /tmp | Check disk space, file permissions |

## 📊 Performance Expectations

### Video Recording
- **File size**: 1-2 MB per minute
- **CPU usage**: 20-30% per session
- **Memory**: 50-100 MB per session
- **Disk I/O**: 2-3 MB/s

### Audio Recording
- **File size**: 0.1-0.2 MB per minute
- **CPU usage**: 5-10% per session
- **Memory**: 10-20 MB per session
- **Disk I/O**: 0.2-0.5 MB/s

## ✨ Success Indicators

You know implementation is successful when:

- ✅ Recording starts and stops without errors
- ✅ Server logs show finalization success
- ✅ Recordings appear in Payload CMS
- ✅ Browser close scenario works (failsafe)
- ✅ No console errors in client
- ✅ File cleanup works (temp files deleted)
- ✅ Test with both video and audio works

## 🔄 Rollback Instructions

If you need to rollback to old client-side finalization:

1. Revert changes to `video-call-provider-mediasoup.tsx` (restore old `onRecordingStopped`)
2. Keep changes to `mediasoup-server.ts` (server still handles most of the work)
3. Resume using `/api/mediasoup-recording/finalize` endpoint

## 📞 Support

If you encounter issues:

1. Check this checklist first
2. Review logs in `DEBUGGING` section
3. Check `MEDIASOUP_RECORDING_FIX.md` for detailed explanations
4. Verify all environment variables are set correctly

---

**Last Updated**: 2025-05-05  
**Status**: ✅ Ready for Testing
