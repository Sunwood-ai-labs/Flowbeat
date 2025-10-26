import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    // Use a smaller portion of frequency bins for a cleaner look
    const bufferLength = analyserNode.frequencyBinCount * 0.7;
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyserNode.getByteFrequencyData(dataArray);

      const isSilent = dataArray.every(v => v === 0);

      canvasCtx.fillStyle = 'hsl(240 10% 3.9%)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (isSilent) return;

      const barWidth = (canvas.width / bufferLength) * 1.25;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const hue = 200 + (dataArray[i] / 255) * 80;
        const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
        gradient.addColorStop(0.5, `hsl(${hue + 20}, 100%, 60%)`);
        gradient.addColorStop(1, `hsl(${hue + 40}, 100%, 70%)`);

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 2;
      }
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