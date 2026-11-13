import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes timeout to handle long Ollama generations

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.headers.get('authorization') || '';
    const roomId = req.headers.get('x-room-id') || '';
    
    const backendUrl = process.env.API_URL || 'http://backend:8000';
    
    // Create an AbortController with a 5-minute timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    
    const response = await fetch(`${backendUrl}/api/ai/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'X-Room-Id': roomId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return NextResponse.json(json, { status: response.status });
      } catch {
        return NextResponse.json({ detail: text }, { status: response.status });
      }
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ detail: 'The AI request timed out after 5 minutes.' }, { status: 504 });
    }
    console.error("AI query proxy error:", error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
