"use client";
import { cn } from "@/lib/utils";
import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, X, FileIcon } from "lucide-react";

export const FileUpload = ({
  onChange,
  accept,
}: {
  onChange: (file: File) => void;
  accept?: string;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (newFiles: FileList | null) => {
    const selectedFile = newFiles?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      onChange(selectedFile);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        className={cn(
          "relative group/file block p-10 w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-border hover:border-accent transition-colors bg-card"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={(e) => handleFileChange(e.target.files)}
          className="hidden"
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          {!file ? (
            <>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="p-4 bg-accent/10 text-accent rounded-full"
              >
                <Upload className="w-8 h-8" />
              </motion.div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-secondary">
                  Excel (.xlsx, .xls) or CSV files
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4 bg-muted p-4 rounded-lg border border-border w-full max-w-md">
              <FileIcon className="w-10 h-10 text-accent" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-secondary">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="p-1 hover:bg-accent/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-secondary hover:text-foreground" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
