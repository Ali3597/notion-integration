import { NextResponse } from "next/server";

// Snapshots removed — account balances are now computed from transactions.
export async function GET() { return NextResponse.json({ error: "Deprecated" }, { status: 410 }); }
export async function POST() { return NextResponse.json({ error: "Deprecated" }, { status: 410 }); }
export async function PATCH() { return NextResponse.json({ error: "Deprecated" }, { status: 410 }); }
export async function DELETE() { return NextResponse.json({ error: "Deprecated" }, { status: 410 }); }
