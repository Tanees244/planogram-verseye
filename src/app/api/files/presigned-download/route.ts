import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface PresignedDownloadRequest {
  objectKey: string;
}

export async function POST(req: NextRequest) {
  let body: PresignedDownloadRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  if (!body?.objectKey) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'objectKey is required', statusCode: 400 },
      { status: 400 }
    );
  }

  return proxyLayout(req, '/api/v1/files/presigned-download', {
    method: 'POST',
    body: { objectKey: body.objectKey },
  });
}
