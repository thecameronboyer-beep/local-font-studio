import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

type NativeFileData = {
  base64Data?: string;
  fileName: string;
  textData?: string;
};

type NativeShareFileOptions = NativeFileData & {
  dialogTitle: string;
  text?: string;
  title: string;
};

function getNativeFileData(options: NativeFileData) {
  if (typeof options.textData === "string") {
    return {
      data: options.textData,
      encoding: Encoding.UTF8,
    };
  }

  if (options.base64Data) {
    return {
      data: options.base64Data,
      encoding: undefined,
    };
  }

  throw new Error("Missing native file data.");
}

export function isNativeFilePlatform() {
  return Capacitor.isNativePlatform();
}

export async function saveNativeFileToDocuments(options: NativeFileData) {
  const fileData = getNativeFileData(options);

  return Filesystem.writeFile({
    data: fileData.data,
    directory: Directory.Documents,
    encoding: fileData.encoding,
    path: `Quill/${options.fileName}`,
    recursive: true,
  });
}

export async function shareNativeFile(options: NativeShareFileOptions) {
  const fileData = getNativeFileData(options);
  const writeResult = await Filesystem.writeFile({
    data: fileData.data,
    directory: Directory.Cache,
    encoding: fileData.encoding,
    path: `share/${Date.now()}-${options.fileName}`,
    recursive: true,
  });

  await Share.share({
    dialogTitle: options.dialogTitle,
    files: [writeResult.uri],
    ...(options.text ? { text: options.text } : {}),
    title: options.title,
  });

  return writeResult;
}
