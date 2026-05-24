## ADDED Requirements

### Requirement: Download quality independent from streaming quality
The system SHALL provide a separate quality setting for downloads, independent of the streaming quality setting. The default download quality SHALL be 320kbps.

#### Scenario: User changes download quality
- **WHEN** user selects a download quality from the download settings section
- **THEN** subsequent downloads SHALL use the selected quality for URL resolution and file download

#### Scenario: Streaming quality unchanged
- **WHEN** user changes download quality to 128kbps
- **THEN** the streaming quality setting SHALL remain unchanged at its previous value

#### Scenario: Default download quality
- **WHEN** the app is first launched with no stored download quality preference
- **THEN** the download quality SHALL default to "320" (320kbps)

### Requirement: Download settings section in SettingsPage
The system SHALL display a dedicated "下载设置" (Download Settings) section in the Settings page, containing download quality, embed cover toggle, embed lyrics toggle, and download directory (native only).

#### Scenario: Settings page shows download section
- **WHEN** user navigates to the Settings page
- **THEN** a "下载设置" section SHALL be visible with download quality selector, embed cover switch, and embed lyrics switch

#### Scenario: Download directory setting visible on native only
- **WHEN** user is on a native platform (Android)
- **THEN** the download directory setting item SHALL be visible in the download settings section
- **WHEN** user is on a web platform
- **THEN** the download directory setting item SHALL NOT be visible

### Requirement: Embed cover toggle
The system SHALL provide a toggle switch to enable/disable embedding cover art into downloaded MP3 files. The toggle SHALL default to enabled.

#### Scenario: Embed cover enabled
- **WHEN** user downloads a song with "内嵌封面" toggle enabled
- **THEN** the downloaded MP3 file SHALL contain the cover image embedded in an ID3v2 APIC frame

#### Scenario: Embed cover disabled
- **WHEN** user downloads a song with "内嵌封面" toggle disabled
- **THEN** the downloaded MP3 file SHALL NOT contain any embedded cover art

### Requirement: Embed lyrics toggle
The system SHALL provide a toggle switch to enable/disable embedding lyrics into downloaded MP3 files. The toggle SHALL default to enabled.

#### Scenario: Embed lyrics enabled
- **WHEN** user downloads a song with "内嵌歌词" toggle enabled
- **THEN** the downloaded MP3 file SHALL contain the song lyrics embedded in an ID3v2 USLT frame

#### Scenario: Embed lyrics disabled
- **WHEN** user downloads a song with "内嵌歌词" toggle disabled
- **THEN** the downloaded MP3 file SHALL NOT contain any embedded lyrics

#### Scenario: Lyrics not available
- **WHEN** user downloads a song with embed lyrics enabled but no lyrics are available from the provider
- **THEN** the download SHALL complete successfully without embedding lyrics, and SHALL NOT show an error
