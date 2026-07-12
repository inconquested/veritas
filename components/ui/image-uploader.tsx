"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Link, Link2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ImageUploaderProps = {
  id?: string;
  urlValue: string;
  onUrlChange: (value: string) => void;
  fileValue: File | null;
  onFileChange: (file: File | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
};

export function ImageUploader({
  id = "image-uploader",
  urlValue,
  onUrlChange,
  fileValue,
  onFileChange,
  label = "Image",
  placeholder = "https://example.com/image.png",
  className,
}: ImageUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [tab, setTab] = React.useState<"url" | "file">(
    fileValue ? "file" : "url",
  );
  const [previewUrl, setPreviewUrl] = React.useState<string>(urlValue);

  React.useEffect(() => {
    if (fileValue) {
      const objectUrl = URL.createObjectURL(fileValue);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(urlValue);
  }, [fileValue, urlValue]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as "url" | "file")}
      className={cn("space-y-3", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <TabsList className="grid w-52 grid-cols-2">
          <TabsTrigger value="url">
            <Link className="pointer-events-none mr-2 h-4 w-4" />
            URL
          </TabsTrigger>
          <TabsTrigger value="file">
            <Upload className="pointer-events-none mr-2 h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>
      </div>

      <Card className="overflow-hidden border border-border/60 bg-muted/20">
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary/10 via-background to-muted">
          {previewUrl ? (
            <>
              <Image
                src={previewUrl}
                alt="Selected preview"
                fill
                unoptimized
                className="object-cover transition-transform duration-300 ease-out motion-safe:hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/10 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="rounded-full bg-background/80 p-3 shadow-sm transition-transform duration-300 motion-safe:hover:scale-110">
                <ImagePlus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Drop in a cover image</p>
              <p className="px-4 text-center text-xs">
                Paste a URL or upload a file. We&apos;ll use whichever you
                provide last.
              </p>
            </div>
          )}
        </div>

        <div className="p-3">
          <TabsContent value="url" animated className="mt-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={id}
                  value={urlValue}
                  onChange={(event) => {
                    onUrlChange(event.target.value);
                    if (event.target.value) onFileChange(null);
                  }}
                  placeholder={placeholder}
                  className="pl-9"
                />
              </div>
              {urlValue ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onUrlChange("")}
                  aria-label="Clear image URL"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="file" animated className="mt-0">
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  onFileChange(file);
                  if (file) onUrlChange("");
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-6 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Upload className="h-4 w-4" />
                {fileValue ? fileValue.name : "Choose an image file"}
              </button>
            </>
          </TabsContent>
        </div>
      </Card>
    </Tabs>
  );
}
