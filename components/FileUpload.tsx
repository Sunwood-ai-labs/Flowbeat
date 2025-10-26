
import React, { useRef } from 'react';
import { Button } from './ui/Button';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFilesAdded: (files: FileList) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesAdded }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesAdded(e.target.files);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={inputRef}
        multiple
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button onClick={handleClick} className="w-full">
        <UploadIcon className="w-4 h-4 mr-2" />
        Add Tracks
      </Button>
    </div>
  );
};

export default FileUpload;
