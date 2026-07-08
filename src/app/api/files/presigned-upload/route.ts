import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

/** Request a presigned upload URL, then PUT the file from the client (or server). */
export async function POST(req: NextRequest) {
  let body: {
    fileName?: string;
    contentType?: string;
    folder?: string | null;
    bucket?: string | null;
    objectKey?: string | null;
    expiresInMinutes?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }

  if (!body.fileName || !body.contentType) {
    return NextResponse.json(
      {
        isRequestSuccess: false,
        message: 'fileName and contentType are required',
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  return proxyLayout(req, '/api/v1/files/presigned-upload', {
    method: 'POST',
    body: {
      fileName: body.fileName,
      contentType: body.contentType,
      folder: body.folder ?? 'skus',
      bucket: body.bucket ?? null,
      objectKey: body.objectKey ?? null,
      expiresInMinutes: body.expiresInMinutes ?? null,
    },
  });
}
