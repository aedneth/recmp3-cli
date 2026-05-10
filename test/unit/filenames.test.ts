import { describe, expect, it } from 'vitest';
import { generateRecordingName, transcriptPath } from '../../src/output/filenames.js';

describe('generateRecordingName', () => {
  it('slugifies spaces to hyphens when name given', () => {
    const name = generateRecordingName({ name: 'my idea', ext: 'wav' });
    expect(name).toMatch(/^my-idea-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.wav$/);
  });

  it('strips special characters from name', () => {
    const name = generateRecordingName({ name: 'hello! world?', ext: 'mp3' });
    expect(name).toMatch(/^hello-world-/);
    expect(name).toMatch(/\.mp3$/);
  });

  it('uses prefix fallback when no name given', () => {
    const name = generateRecordingName({ ext: 'wav' });
    expect(name).toMatch(/^rec-/);
  });

  it('uses custom prefix when specified', () => {
    const name = generateRecordingName({ prefix: 'meeting', ext: 'wav' });
    expect(name).toMatch(/^meeting-/);
  });

  it('lowercases the slug', () => {
    const name = generateRecordingName({ name: 'My Idea' });
    expect(name).toMatch(/^my-idea-/);
  });

  it('defaults ext to wav', () => {
    const name = generateRecordingName({ name: 'test' });
    expect(name).toMatch(/\.wav$/);
  });
});

describe('transcriptPath', () => {
  it('replaces wav extension with txt', () => {
    expect(transcriptPath('/tmp/recording.wav', 'txt')).toBe('/tmp/recording.txt');
  });

  it('replaces mp3 extension with json', () => {
    expect(transcriptPath('/home/user/audio.mp3', 'json')).toBe('/home/user/audio.json');
  });

  it('handles paths with dots in directory names', () => {
    expect(transcriptPath('/home/user.name/audio.wav', 'txt')).toBe('/home/user.name/audio.txt');
  });

  it('handles ogg extension', () => {
    expect(transcriptPath('/tmp/rec.ogg', 'txt')).toBe('/tmp/rec.txt');
  });
});
