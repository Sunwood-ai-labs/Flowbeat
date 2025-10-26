
import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyserNode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyserNode.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'hsl(222.2 84% 4.9%)'; // background color from tailwind.config
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'hsl(210 40% 98%)'; // primary-foreground

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
      // Clear canvas when component unmounts or effect re-runs
      if (canvasCtx) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [analyserNode, isPlaying]);

  return (
    <div className="bg-background rounded-lg border aspect-[4/1] w-full overflow-hidden">
        <canvas ref={canvasRef} width="1024" height="256" className="w-full h-full" />
    </div>
  );
};

export default Visualizer;
