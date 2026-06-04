import { render, screen } from '@testing-library/react';
import ArticleCard from './ArticleCard';

describe('ArticleCard', () => {
  const defaultProps = {
    title: 'Test Article',
    description: 'A test description for the article',
    link: 'https://example.com/article',
    feedTitle: 'Test Feed',
    pubDate: new Date('2024-01-15T12:00:00Z'),
    locale: 'en',
    readMoreLabel: 'Read more',
    fromFeedLabel: 'Source',
    publishedAtLabel: 'Published on',
  };

  it('renders the article title', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('Test Article')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('A test description for the article')).toBeInTheDocument();
  });

  it('renders the feed source', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText(/Test Feed/)).toBeInTheDocument();
  });

  it('renders the publication date', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText(/Published on/)).toBeInTheDocument();
  });

  it('renders a link with the readMore label including arrow', () => {
    render(<ArticleCard {...defaultProps} />);
    const link = screen.getByRole('link', { name: /Read more/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/article');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders without optional fields', () => {
    render(
      <ArticleCard
        locale="en"
        readMoreLabel="Read more"
        fromFeedLabel="Source"
        publishedAtLabel="Published on"
      />,
    );
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('renders without link when not provided', () => {
    render(
      <ArticleCard
        title="No Link"
        locale="en"
        readMoreLabel="Read more"
        fromFeedLabel="Source"
        publishedAtLabel="Published on"
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('formats the date in abbreviated month format for en locale', () => {
    render(<ArticleCard {...defaultProps} locale="en" />);
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });
});
