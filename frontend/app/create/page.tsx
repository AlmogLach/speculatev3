'use client';

import Header from '@/components/Header';
import CreateMarketForm from '@/components/CreateMarketForm';

export default function CreateMarketPage() {
  return (
    <>
      <Header />
      <CreateMarketForm standalone={true} />
    </>
  );
}

