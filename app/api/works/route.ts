import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/data/repository';
import type { WorkSort } from '@/lib/data/repository';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sort = (url.searchParams.get('sort') === 'manual' ? 'manual' : 'latest') as WorkSort;
    const repo = await getRepository();
    const result = await repo.listPublishedPaged({
      category: url.searchParams.get('category') ?? undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      sort,
      page: Number(url.searchParams.get('page') ?? 1) || 1,
      pageSize: Number(url.searchParams.get('pageSize') ?? 9) || 9,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '加载失败' }, { status: 500 });
  }
}
