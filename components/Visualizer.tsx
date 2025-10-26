import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean; // Retained for potential future use, but not gating the animation loop
}

const Visualizer: React.FC<VisualizerProps> = ({ analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyserNode.getByteTimeDomainData(dataArray);

      // A check to see if there's silence
      const isSilent = dataArray.every(v => v === 128);

      canvasCtx.fillStyle = 'hsl(240 10% 3.9%)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (isSilent) return; // Don't draw anything if silent

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'hsl(0 0% 98%)';

      canvasCtx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [analyserNode]);

  return (
    <div className="bg-background rounded-lg border aspect-[4/1] w-full overflow-hidden">
        <canvas ref={canvasRef} width="1024" height="256" className="w-full h-full" />
    </div>
  );
};

export default Visualizer;
