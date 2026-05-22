import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, render } from 'ink';
import { AudioCapture, CaptureOptions, CaptureSegment } from '../audio/types.js';
import { concatSegments } from '../audio/concat.js';

type RecStatus = 'recording' | 'paused' | 'saving' | 'done' | 'cancelled' | 'error';

interface RecorderState {
  status: RecStatus;
  elapsedMs: number;
  segmentCount: number;
  statusMessage?: string;
}

export interface RecorderResult {
  cancelled: boolean;
  outputPath?: string;
  segments: CaptureSegment[];
  totalDurationMs: number;
}

interface RecorderProps {
  capture: AudioCapture;
  captureOpts: CaptureOptions & { tmpDir: string };
  outputPath: string;
  onResult: (result: RecorderResult) => void;
}

const RecorderUI: React.FC<RecorderProps> = ({ capture, captureOpts, outputPath, onResult }) => {
  const { exit } = useApp();
  const [status, setStatus] = useState<RecStatus>('recording');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [segmentCount, setSegmentCount] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const segmentsRef = useRef<CaptureSegment[]>([]);
  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef(Date.now());
  const currentSegmentIndexRef = useRef(1);
  const isRecordingRef = useRef(true);

  // Live timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRecordingRef.current) {
        setElapsedMs(accumulatedMsRef.current + (Date.now() - segmentStartRef.current));
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const stopCurrentSegment = useCallback(async (): Promise<CaptureSegment | null> => {
    if (!isRecordingRef.current) return null;
    try {
      const segment = await capture.stop();
      accumulatedMsRef.current += Date.now() - segmentStartRef.current;
      isRecordingRef.current = false;
      segmentsRef.current.push(segment);
      return segment;
    } catch {
      return null;
    }
  }, [capture]);

  const startNewSegment = useCallback(async () => {
    currentSegmentIndexRef.current += 1;
    const segPath = `${captureOpts.tmpDir}/segment-${String(currentSegmentIndexRef.current).padStart(4, '0')}.wav`;
    await capture.start({ ...captureOpts, outputPath: segPath });
    segmentStartRef.current = Date.now();
    isRecordingRef.current = true;
    setSegmentCount(currentSegmentIndexRef.current + 1);
  }, [capture, captureOpts]);

  const handlePause = useCallback(async () => {
    if (busy || status !== 'recording') return;
    setBusy(true);
    await stopCurrentSegment();
    setStatus('paused');
    setBusy(false);
  }, [busy, status, stopCurrentSegment]);

  const handleResume = useCallback(async () => {
    if (busy || status !== 'paused') return;
    setBusy(true);
    await startNewSegment();
    setStatus('recording');
    setBusy(false);
  }, [busy, status, startNewSegment]);

  const handleSave = useCallback(async () => {
    if (busy || (status !== 'recording' && status !== 'paused')) return;
    setBusy(true);
    setStatus('saving');

    try {
      await stopCurrentSegment();
      setStatusMessage('Concatenating segments...');

      const finalPath = await concatSegments(
        segmentsRef.current,
        outputPath,
        captureOpts.tmpDir,
        'wav',
      );

      setStatusMessage('');
      setStatus('done');

      onResult({
        cancelled: false,
        outputPath: finalPath,
        segments: segmentsRef.current,
        totalDurationMs: accumulatedMsRef.current,
      });

      setTimeout(() => exit(), 800);
    } catch (err: unknown) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : String(err));
      setTimeout(() => exit(), 2000);
    }
  }, [busy, status, stopCurrentSegment, outputPath, captureOpts.tmpDir, onResult, exit]);

  const handleCancel = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await capture.dispose();
    setStatus('cancelled');
    onResult({ cancelled: true, segments: [], totalDurationMs: 0 });
    setTimeout(() => exit(), 300);
  }, [busy, capture, onResult, exit]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') { handleCancel(); return; }
    if (input === 'c' || key.escape) { handleCancel(); return; }
    if (input === 'p' || input === ' ') {
      if (status === 'recording') handlePause();
      else if (status === 'paused') handleResume();
      return;
    }
    if (input === 's' || key.return) { handleSave(); return; }
  });

  const elapsed = Math.floor(elapsedMs / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const statusColors: Record<RecStatus, string> = {
    recording: 'red',
    paused: 'yellow',
    saving: 'cyan',
    done: 'green',
    cancelled: 'gray',
    error: 'red',
  };

  const statusLabels: Record<RecStatus, string> = {
    recording: '● REC',
    paused: '‖ PAUSED',
    saving: '◌ SAVING',
    done: '✓ DONE',
    cancelled: '✗ CANCELLED',
    error: '✗ ERROR',
  };

  const showControls = status === 'recording' || status === 'paused';

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1} width={44}>
      <Box justifyContent="center">
        <Text bold color={statusColors[status] as 'red' | 'yellow' | 'cyan' | 'green' | 'gray'}>
          {statusLabels[status]}  {timeStr}
        </Text>
      </Box>
      {statusMessage ? (
        <Box justifyContent="center" marginTop={1}>
          <Text color="cyan">{statusMessage}</Text>
        </Box>
      ) : showControls ? (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray">
            {status === 'recording' ? '[p] pause' : '[p] resume'}  [s] save  [c] cancel
          </Text>
        </Box>
      ) : null}
    </Box>
  );
};

export async function runRecorderTUI(
  capture: AudioCapture,
  captureOpts: Omit<CaptureOptions, 'outputPath'> & { tmpDir: string },
  outputPath: string,
): Promise<RecorderResult> {
  return new Promise((resolve) => {
    let result: RecorderResult | null = null;

    const { waitUntilExit } = render(
      <RecorderUI
        capture={capture}
        captureOpts={{ ...captureOpts, outputPath: `${captureOpts.tmpDir}/segment-0001.wav` }}
        outputPath={outputPath}
        onResult={(r) => { result = r; }}
      />,
      { exitOnCtrlC: false },
    );

    waitUntilExit().then(() => {
      resolve(result ?? { cancelled: true, segments: [], totalDurationMs: 0 });
    });
  });
}
