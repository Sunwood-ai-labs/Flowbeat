import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { cn } from '../lib/utils';

interface PromptSettingsProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  className?: string;
}

const PromptSettings: React.FC<PromptSettingsProps> = ({ prompt, onPromptChange, className }) => {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle>Gemini Prompt</CardTitle>
        <CardDescription>
          Fine-tune how Gemini suggests mix points. Add extra guidance like preferred intro length or energy vibe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <label className="block text-sm font-medium text-muted-foreground" htmlFor="gemini-prompt">
          Additional Instructions
        </label>
        <textarea
          id="gemini-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          className="w-full min-h-[160px] resize-y rounded-md border border-border bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Example: Keep transitions under 20 seconds and highlight high-energy sections."
        />
        <p className="text-xs text-muted-foreground">
          We’ll add these notes on top of the default DJ instructions when asking Gemini for mix points.
        </p>
      </CardContent>
    </Card>
  );
};

export default PromptSettings;
