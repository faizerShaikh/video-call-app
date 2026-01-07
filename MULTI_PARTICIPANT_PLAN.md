# Multi-Participant Support Implementation Plan

## Current State (1-to-1 Only)

The current implementation supports only **2 participants** (1-to-1 calls):
- Single `peerConnectionRef` - one peer connection
- Single `remoteStream` - one remote stream
- Single `remoteVideoEnabled` / `remoteAudioEnabled` - one remote participant's state
- UI shows fixed 2 video feeds (local + 1 remote)

## What Needs to Change

### 1. **Multiple Peer Connections**
- Change from single `peerConnectionRef` to a **Map** of peer connections
- Key: `socketId` of the remote participant
- Value: `RTCPeerConnection` instance
- Each participant needs their own peer connection

### 2. **Multiple Remote Streams**
- Change from single `remoteStream` to a **Map** of remote streams
- Key: `socketId` of the remote participant
- Value: `MediaStream` from that participant
- Track each participant's video/audio stream separately

### 3. **Per-Participant Media State**
- Change from single `remoteVideoEnabled` / `remoteAudioEnabled` to a **Map**
- Key: `socketId` of the remote participant
- Value: `{ videoEnabled: boolean, audioEnabled: boolean }`
- Track each participant's media state separately

### 4. **Offer/Answer/ICE Handling**
- When receiving an offer/answer/ICE candidate, identify which participant it's from
- Route to the correct peer connection based on `from` socketId
- Handle multiple simultaneous offers/answers

### 5. **Dynamic UI**
- Change from fixed 2-column grid to dynamic grid
- Show all participants' videos (local + all remotes)
- Responsive layout that adjusts based on number of participants
- Show participant names/IDs

### 6. **Participant Management**
- When a new participant joins:
  - Create a new peer connection for them
  - Send them an offer (or wait for their offer)
  - Add their video feed to the UI
- When a participant leaves:
  - Close their peer connection
  - Remove their stream from state
  - Remove their video feed from UI
  - Clean up their media state

## Implementation Approach

### Option 1: Mesh Network (Full Mesh)
- Each participant connects directly to every other participant
- **Pros**: No server-side media processing needed, low latency
- **Cons**: High bandwidth usage (N-1 connections per participant), complex to manage
- **Best for**: Small groups (3-5 participants)

### Option 2: SFU (Selective Forwarding Unit)
- Server acts as a media router
- **Pros**: Lower bandwidth per client, better scalability
- **Cons**: Requires server-side media processing (more complex)
- **Best for**: Larger groups (5+ participants)

### Option 3: Hybrid (Recommended for now)
- Start with Mesh Network (easier to implement)
- Can upgrade to SFU later if needed
- **Pros**: Works with current server setup, easier to implement
- **Cons**: Bandwidth scales with participants

## Recommended Implementation Steps

1. **Refactor `useWebRTC` hook**:
   - Replace single peer connection with Map
   - Replace single remote stream with Map
   - Update all functions to handle multiple participants

2. **Update signaling logic**:
   - Handle offers/answers per participant
   - Track which participant each connection is for
   - Handle participant join/leave events

3. **Update UI components**:
   - Dynamic video grid based on participant count
   - Show all remote participants' videos
   - Display participant names/IDs

4. **Test with 3+ participants**:
   - Verify all participants can see each other
   - Test join/leave scenarios
   - Test media state indicators for all participants

## Complexity Estimate

- **Time**: 2-4 hours of development
- **Difficulty**: Medium (requires refactoring core WebRTC logic)
- **Risk**: Medium (need to ensure all edge cases are handled)

## Current Limitations

- Server already supports multiple participants in a room (Socket.io room management)
- The limitation is in the client-side WebRTC implementation
- UI is hardcoded for 2 participants

## Next Steps

Would you like me to implement multi-participant support? I can:
1. Refactor the `useWebRTC` hook to support multiple participants
2. Update the UI to dynamically show all participants
3. Handle participant join/leave events
4. Test with 3+ participants

Let me know if you'd like me to proceed!

