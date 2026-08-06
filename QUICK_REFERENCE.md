# MediaSoup Server-Side Recording - Quick Reference

## 🎯 Main Concept

```
BEFORE (Risky ❌)        AFTER (Safe ✅)
───────────────────     ──────────────────
Client: start    →      Client: start  →
Server: record   ←      Server: record →
Client: stop     →      Client: stop   →
Client: finalize →      Server: finalize → (automatic!)
Server: save     ←      Server: save   ←
```

## 🔑 Key Changes at a Glance

| Component | What Changed |
|-----------|--------------|
| **roomId format** | `appointment_123` (with appointmentId) |
| **RecordingSession** | Now stores `appointmentId` and `recordingType` |
| **start-recording** | Extracts appointmentId, passes to recorder |
| **stop-recording** | Calls finalize API automatically (server-to-server) |
| **Client handler** | No longer calls finalize, just shows toast |
| **Auth method** | `serverSecret` instead of JWT token |

## 🔧 Setup (2 Steps)

### 1. Environment Variables

```bash
# Copy to .env.local
NEXTJS_URL=http://localhost:3000
MEDIASOUP_SERVER_SECRET=$(openssl rand -base64 32)
```

### 2. Directory Setup

```bash
mkdir -p /tmp/mediasoup-recordings
chmod 755 /tmp/mediasoup-recordings
```

## 🧪 Quick Test (3 Steps)

```bash
# 1. Start server
pnpm dev

# 2. Test basic flow
# - Open 2 browsers, same room
# - Click "Start Recording"
# - Say something
# - Click "Stop Recording"

# 3. Verify
# - Check toast: "Запись консультации сохранена"
# - Check logs: "[MediaSoup] Recording finalized successfully"
# - Check CMS: appointment.recording populated
```

## 📊 Data Flow Diagram

```
┌──────────────┐
│   BROWSER    │
│   (Doctor)   │
└──────┬───────┘
       │
       │ emit('start-recording', { roomId, recordingType })
       ▼
┌──────────────────┐
│ MediaSoup Server │
│                  │
│ 1. Extract ID    │
│    from roomId   │
│ 2. Start record  │
│ 3. Save appointID│
└──────┬───────────┘
       │
       │ Recording to /tmp/
       ▼
    [Recording...]
       │
       │ emit('stop-recording', { roomId })
       ▼
┌──────────────────┐
│ MediaSoup Server │
│                  │
│ 1. Stop record   │
│ 2. Get appointID │
│ 3. Call finalize │
│    API w/secret  │
└──────┬───────────┘
       │
       │ POST /api/mediasoup-recording/finalize-server
       │ { appointmentId, sessionId, serverSecret }
       ▼
┌──────────────────┐
│   Next.js API    │
│                  │
│ 1. Verify secret │
│ 2. Load file     │
│ 3. Upload media  │
│ 4. Create record │
│ 5. Delete temp   │
└──────┬───────────┘
       │
       │ { success, recordingId }
       ▼
┌──────────────────┐
│ MediaSoup Server │
│                  │
│ emit('recording- │
│ stopped', {      │
│   finalized: ✓   │
│   recordingId: X │
│ })               │
└──────┬───────────┘
       │
       │ Event to all users
       ▼
┌──────────────┐
│   BROWSER    │
│              │
│ Toast: "✓"   │
└──────────────┘
```

## 🛡️ Safety Features

```
Scenario 1: Normal stop
  ✅ Recording finalized
  ✅ Data in CMS

Scenario 2: Browser closes
  ✅ Server detects disconnect
  ✅ Finalizes automatically
  ✅ Data still in CMS

Scenario 3: Network timeout
  ⚠️ Finalization fails
  ✅ But file still in /tmp
  ✅ Can retry manually
```

## 📋 File Locations

```
Code Changes:
  src/lib/mediasoup/recorder.ts
  src/mediasoup-server.ts
  src/components/video-call/hooks/use-mediasoup-connection.ts
  src/components/video-call/video-call-provider-mediasoup.tsx

Documentation:
  MEDIASOUP_RECORDING_FIX.md (detailed)
  IMPLEMENTATION_SUMMARY.md (what changed)
  IMPLEMENTATION_CHECKLIST.md (testing)
  QUICK_REFERENCE.md (this file)

Recording Storage:
  /tmp/mediasoup-recordings/ (during recording)
  Payload CMS Media (final storage)
```

## 🚨 Troubleshooting

| Error | Check |
|-------|-------|
| "Recording file not found" | `/tmp/mediasoup-recordings/` exists? Permissions ok? |
| "serverSecret verification failed" | `MEDIASOUP_SERVER_SECRET` same in both places? |
| "NEXTJS_URL not reachable" | Can server reach Next.js? Firewall ok? |
| "No appointmentId" | roomId format correct? (`appointment_123`) |
| "Recording not in CMS" | Appointment exists in DB? |

## 📞 Key API Endpoints

```
Client → Server:
  emit('start-recording', { roomId, recordingType })
  emit('stop-recording', { roomId })

Server → Server:
  POST /api/mediasoup-recording/finalize-server
  { appointmentId, sessionId, serverSecret, recordingType, durationSeconds }

Server → Client:
  emit('recording-stopped', { sessionId, recordingId, finalized })
```

## ✅ Verification Commands

```bash
# Check if env vars are set
echo $NEXTJS_URL
echo $MEDIASOUP_SERVER_SECRET

# Check if directory exists
ls -la /tmp/mediasoup-recordings/

# Test finalize API manually
curl -X POST http://localhost:3000/api/mediasoup-recording/finalize-server \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":123,"sessionId":"test","recordingType":"video","serverSecret":"YOUR_SECRET","durationSeconds":60}'

# Watch recording files in real-time
watch 'ls -lh /tmp/mediasoup-recordings/'
```

## 🎬 Event Sequence

```
1. [Client] emit('start-recording')
2. [Server] receive, extract appointmentId, start recording
3. [Server] emit('recording-started') to all users
4. ... (recording in progress) ...
5. [Client] emit('stop-recording')
6. [Server] receive, stop recording
7. [Server] call finalize-server API
8. [NextJS] verify secret, upload file, create record
9. [Server] receive success response
10. [Server] emit('recording-stopped', { recordingId, finalized })
11. [Client] receive, show toast
12. [All] Recording in CMS, available forever ✅
```

## 💾 Storage Flow

```
During Call:
  [Browser Audio/Video] → 
  [Server Capture via RTP] → 
  [FFmpeg Processing] → 
  [/tmp/mediasoup-recordings/session-123.webm]

After Stop:
  [/tmp/session-123.webm] → 
  [Next.js API receives] → 
  [Upload to Media Storage] → 
  [Create CallRecording in DB] → 
  [Delete /tmp file] → 
  [Permanent in CMS] ✅
```

## 🔐 Security

```
✅ No JWT token exposed in server calls
✅ serverSecret kept on server only
✅ File storage on server, not client
✅ All finalization server-side
✅ No data loss on client disconnect
✅ Automatic cleanup of temp files
```

## 🎯 Success Checklist

- [ ] env vars set
- [ ] /tmp/mediasoup-recordings/ exists
- [ ] pnpm dev runs without errors
- [ ] Start recording works
- [ ] Stop recording works
- [ ] Toast shows success
- [ ] Server logs show finalization
- [ ] Recording in CMS
- [ ] Browser close failsafe works
- [ ] Temp files cleaned up

---

**Print this page or bookmark it for quick reference!**
