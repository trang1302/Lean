import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('render children luôn', () => {
    render(
      <Card>
        <p>Nội dung</p>
      </Card>,
    );
    expect(screen.getByText('Nội dung')).toBeTruthy();
  });

  it('heading tuỳ chọn — không render tiêu đề khi không truyền', () => {
    render(
      <Card>
        <p>Nội dung</p>
      </Card>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('render tiêu đề khi có heading', () => {
    render(
      <Card heading="Cân nặng hôm nay">
        <p>Nội dung</p>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Cân nặng hôm nay' })).toBeTruthy();
  });
});
