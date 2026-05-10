import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const API_BASE_URL = process.env.API_BASE_URL;

// S3 Configuration from environment
const S3_REGION = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID || '',
        secretAccessKey: AWS_SECRET_ACCESS_KEY || '',
    },
});

function sanitizeFilename(name: string) {
    return name.replace(/[^\w.\-()+\s]/g, '_').replace(/\s+/g, '_');
}

function buildS3Url(bucket: string, region: string, key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    if (region === 'us-east-1') {
        return `https://${bucket}.s3.amazonaws.com/${encodedKey}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

export async function POST(req: NextRequest) {
    try {
        const token = await getToken(req);

        if (!token) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401, data: null },
                { status: 401 }
            );
        }

        if (!S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
            console.error('[AddProductImages] S3 configuration missing');
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Server configuration error', statusCode: 500, data: null },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const productId = formData.get('productId') as string;
        const images = formData.getAll('images') as File[];

        if (!productId) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Missing productId', statusCode: 400, data: null },
                { status: 400 }
            );
        }

        if (!images || images.length === 0) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'No images provided', statusCode: 400, data: null },
                { status: 400 }
            );
        }

        const imageUrls: string[] = [];

        // Upload images to S3
        for (const image of images) {
            if (!(image instanceof File)) continue;

            const safeName = sanitizeFilename(image.name || 'product_image.jpg');
            const key = `product-images/${productId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;

            const buffer = Buffer.from(await image.arrayBuffer());

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: key,
                    Body: buffer,
                    ContentType: image.type || 'image/jpeg',
                })
            );

            const url = buildS3Url(S3_BUCKET, S3_REGION, key);
            imageUrls.push(url);
        }

        // Call Backend API
        const response = await fetch(
            `${API_BASE_URL}/IProductFeature/AddProductImages`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    productId,
                    imageUrls,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AddProductImages] Backend error (${response.status}):`, errorText);
            return NextResponse.json(
                {
                    isRequestSuccess: false,
                    message: errorText || `Backend returned ${response.status}`,
                    statusCode: response.status,
                    data: null
                },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('[AddProductImages] SSR error:', error);
        return NextResponse.json(
            { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500, data: null },
            { status: 500 }
        );
    }
}
