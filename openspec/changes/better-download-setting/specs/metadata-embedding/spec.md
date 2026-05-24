## ADDED Requirements

### Requirement: Embed cover art into MP3 on web platform
The system SHALL fetch the cover image via `musicApi.getPic()` and embed it into the downloaded MP3 blob as an ID3v2.3 APIC frame before triggering the browser download.

#### Scenario: Successful cover embedding on web
- **WHEN** a song is downloaded on web platform with embed cover enabled
- **AND** a cover image URL is successfully resolved
- **THEN** the downloaded file SHALL contain the cover image in an ID3v2 APIC frame with MIME type derived from the image data

#### Scenario: Cover fetch fails gracefully
- **WHEN** a song is downloaded on web platform with embed cover enabled
- **AND** the cover image fetch returns null or fails
- **THEN** the download SHALL complete with a warning logged, and the MP3 file SHALL NOT contain an APIC frame

### Requirement: Embed cover art into MP3 on native platform
The system SHALL, after `FileTransfer.downloadFile` completes, read the file, embed the cover art, and write the modified file back to the same path.

#### Scenario: Successful cover embedding on native
- **WHEN** a song is downloaded on native platform with embed cover enabled
- **AND** a cover image is successfully fetched
- **THEN** the file at the download path SHALL be updated to include the cover image in an ID3v2 APIC frame

### Requirement: Embed lyrics into MP3
The system SHALL fetch lyrics via `musicApi.getLyric()` and embed the full lyric text (concatenating all lines from `SongLyric`) into the downloaded MP3 as an ID3v2.3 USLT frame.

#### Scenario: Successful lyrics embedding
- **WHEN** a song is downloaded with embed lyrics enabled
- **AND** lyrics are successfully resolved
- **THEN** the downloaded MP3 SHALL contain the lyrics text in an ID3v2 USLT frame with language code "zho"

#### Scenario: Lyrics fetch fails gracefully
- **WHEN** a song is downloaded with embed lyrics enabled
- **AND** the lyrics API returns null or fails
- **THEN** the download SHALL complete with a warning logged, and the MP3 file SHALL NOT contain a USLT frame

### Requirement: Metadata post-processing pipeline
The system SHALL execute metadata embedding as a post-processing step after the MP3 file is fully downloaded, before the download is marked as complete.

#### Scenario: Post-processing order
- **WHEN** a song download completes with both embed cover and embed lyrics enabled
- **THEN** cover art SHALL be embedded first, then lyrics, then the file SHALL be finalized

#### Scenario: Post-processing progress indication
- **WHEN** metadata embedding is in progress during a single-track download
- **THEN** the toast notification SHALL display "正在写入元数据..." while embedding is in progress

#### Scenario: Large file skip
- **WHEN** the downloaded MP3 file exceeds 50MB
- **THEN** metadata embedding SHALL be skipped and a warning SHALL be logged

### Requirement: Metadata embedding consistency across download modes
The system SHALL apply metadata embedding consistently regardless of whether the download is triggered individually or in batch. Both single and batch downloads SHALL respect the user's embed cover and embed lyrics settings.

#### Scenario: Batch download applies metadata
- **WHEN** user performs a batch download with embed cover and embed lyrics enabled
- **THEN** each downloaded file SHALL contain embedded cover art and lyrics according to the settings
