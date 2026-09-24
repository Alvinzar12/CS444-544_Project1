import { Errors } from 'cs544-js-utils';

/** Note that errors are documented using the `code` option which must be
 *  returned (the `message` can be any suitable string which describes
 *  the error as specifically as possible).  Whenever possible, the
 *  error should also contain a `widget` option specifying the widget
 *  responsible for the error).
 *
 *  Note also that none of the function implementations should normally
 *  require a sequential scan over all books or patrons.
 */

/******************** Types for Validated Requests *********************/

/** used as an ID for a book */
type ISBN = string; 

/** used as an ID for a library patron */
type PatronId = string;

export type Book = {
  isbn: ISBN;
  title: string;
  authors: string[];
  pages: number;      //must be int > 0
  year: number;       //must be int > 0
  publisher: string;
  nCopies?: number;   //# of copies owned by library; not affected by borrows;
                      //must be int > 0; defaults to 1
};

export type XBook = Required<Book>;

type AddBookReq = Book;
type FindBooksReq = { search: string; };
type ReturnBookReq = { patronId: PatronId; isbn: ISBN; };
type CheckoutBookReq = { patronId: PatronId; isbn: ISBN; };

/************************ Main Implementation **************************/

export function makeLendingLibrary() {
  return new LendingLibrary();
}

export class LendingLibrary {

  //ISBN -> book
  private books!: Record<ISBN, XBook>;

  //lower-cased title/author word -> ISBNs containing it
  private wordIndex!: Record<string, Set<ISBN>>;

  //ISBN -> patrons currently holding it
  private checkouts!: Record<ISBN, Set<PatronId>>;

  //patron -> ISBNs they currently hold
  private patronBooks!: Record<PatronId, Set<ISBN>>;

  constructor() {
    this.books = {};
    this.wordIndex = {};
    this.checkouts = {};
    this.patronBooks = {};
  }

  /** Add one-or-more copies of book represented by req to this library.
   *
   *  Errors:
   *    MISSING: one-or-more of the required fields is missing.
   *    BAD_TYPE: one-or-more fields have the incorrect type.
   *    BAD_REQ: other issues like nCopies not a positive integer 
   *             or book is already in library but data in obj is 
   *             inconsistent with the data already present.
   */
  addBook(req: Record<string, any>): Errors.Result<XBook> {
    const validateResult = validateAddBookReq(req);
    if (!validateResult.isOk) return validateResult;
    const book = validateResult.val;
    const isbn = book.isbn;
    const existing = this.books[isbn];
    if (existing) {
      const sameAuthors =
        existing.authors.length === book.authors.length &&
        existing.authors.every((a, i) => a === book.authors[i]);
      const isConsistent =
        existing.title === book.title &&
        existing.publisher === book.publisher &&
        existing.pages === book.pages &&
        existing.year === book.year &&
        sameAuthors;
      if (!isConsistent) {
        const msg =
          `book ${isbn} already in library with different data`;
        return Errors.errResult(msg, 'BAD_REQ', 'isbn');
      }
      existing.nCopies += (book.nCopies ?? 1);
      return Errors.okResult(existing);
    }
    else {
      const xbook: XBook = { ...book, nCopies: book.nCopies ?? 1 };
      this.books[isbn] = xbook;
      const words = extractWords(xbook.title + ' ' + xbook.authors.join(' '));
      for (const word of words) {
        (this.wordIndex[word] ??= new Set<ISBN>()).add(isbn);
      }
      return Errors.okResult(xbook);
    }
  }

  /** Return all books matching (case-insensitive) all "words" in
   *  req.search, where a "word" is a max sequence of /\w/ of length > 1.
   *  Returned books should be sorted in ascending order by title.
   *
   *  Errors:
   *    MISSING: search field is missing
   *    BAD_TYPE: search field is not a string.
   *    BAD_REQ: no words in search
   */
  findBooks(req: Record<string, any>) : Errors.Result<XBook[]> {
    const search = req.search;
    if (search === undefined) {
      return Errors.errResult('property search is required',
                              { code: 'MISSING', widget: 'search' });
    }
    if (typeof search !== 'string') {
      return Errors.errResult('property search must be a string',
                              { code: 'BAD_TYPE', widget: 'search' });
    }
    const words = extractWords(search);
    if (words.length === 0) {
      return Errors.errResult('search must contain at least one word',
                              { code: 'BAD_REQ', widget: 'search' });
    }

    // one set of ISBNs per search word; a never-indexed word matches nothing
    const matchSets = words.map(w => this.wordIndex[w] ?? new Set<ISBN>());

    // keep an ISBN only if every word's set contains it
    const [first, ...rest] = matchSets;
    const isbns = [...first].filter(isbn => rest.every(s => s.has(isbn)));

    const books = isbns.map(isbn => this.books[isbn]);
    books.sort((a, b) => a.title.localeCompare(b.title));
    return Errors.okResult(books);
  }


  /** Set up patron req.patronId to check out book req.isbn. 
   * 
   *  Errors:
   *    MISSING: patronId or isbn field is missing
   *    BAD_TYPE: patronId or isbn field is not a string.
   *    BAD_REQ error on business rule violation.
   */
  checkoutBook(req: Record<string, any>) : Errors.Result<void> {
    //TODO
    return Errors.errResult('TODO');  //placeholder
  }

  /** Set up patron req.patronId to returns book req.isbn.
   *  
   *  Errors:
   *    MISSING: patronId or isbn field is missing
   *    BAD_TYPE: patronId or isbn field is not a string.
   *    BAD_REQ error on business rule violation.
   */
  returnBook(req: Record<string, any>) : Errors.Result<void> {
    //TODO 
    return Errors.errResult('TODO');  //placeholder
  }
  
}


/********************** Domain Utility Functions ***********************/


const REQUIRED_BOOK_FIELDS = [
  'isbn', 'title', 'authors', 'pages', 'year', 'publisher',
] as const;

const STRING_FIELDS = [ 'isbn', 'title', 'publisher' ] as const;
const NUMERIC_FIELDS = [ 'pages', 'year' ] as const;

/** Validate req as a request to add a book, returning either the
 *  validated Book (with fields narrowed/defaulted) or a list of errors.
 */
function validateAddBookReq(req: Record<string, any>): Errors.Result<Book> {
  const errors: Errors.Err[] = [];

  for (const f of REQUIRED_BOOK_FIELDS) {
    if (req[f] === undefined) {
      errors.push(new Errors.Err(`${f} is required`, {
        code: 'MISSING', widget: f,
      }));
    }
  }
  if (errors.length > 0) return new Errors.ErrResult(errors);

  for (const f of STRING_FIELDS) {
    if (typeof req[f] !== 'string') {
      errors.push(new Errors.Err(`${f} must be a string`, {
        code: 'BAD_TYPE', widget: f,
      }));
    }
  }
  for (const f of NUMERIC_FIELDS) {
    if (typeof req[f] !== 'number') {
      errors.push(new Errors.Err(`${f} must be a number`, {
        code: 'BAD_TYPE', widget: f,
      }));
    }
  }
  if (
    !Array.isArray(req.authors) ||
    req.authors.length === 0 ||
    req.authors.some((a: any) => typeof a !== 'string')
  ) {
    errors.push(new Errors.Err(`authors must be a non-empty string array`, {
      code: 'BAD_TYPE', widget: 'authors',
    }));
  }
  if (req.nCopies !== undefined && typeof req.nCopies !== 'number') {
    errors.push(new Errors.Err(`nCopies must be a number`, {
      code: 'BAD_TYPE', widget: 'nCopies',
    }));
  }
  if (errors.length > 0) return new Errors.ErrResult(errors);

  for (const f of NUMERIC_FIELDS) {
    if (!Number.isInteger(req[f]) || req[f] <= 0) {
      errors.push(new Errors.Err(`${f} must be a positive integer`, {
        code: 'BAD_REQ', widget: f,
      }));
    }
  }
  if (
    req.nCopies !== undefined &&
    (!Number.isInteger(req.nCopies) || req.nCopies <= 0)
  ) {
    errors.push(new Errors.Err(`nCopies must be a positive integer`, {
      code: 'BAD_REQ', widget: 'nCopies',
    }));
  }
  if (errors.length > 0) return new Errors.ErrResult(errors);

  const book: Book = {
    isbn: req.isbn,
    title: req.title,
    authors: req.authors,
    pages: req.pages,
    year: req.year,
    publisher: req.publisher,
    ...(req.nCopies !== undefined ? { nCopies: req.nCopies } : {}),
  };
  return Errors.okResult(book);
}

/********************* General Utility Functions ***********************/

/** Extract the distinct lower-cased "words" (max sequences of /\w/ of
 *  length > 1) from text.  Used both to index a book's title/authors
 *  when it is added and to tokenize a findBooks() search string.
 */
function extractWords(text: string): string[] {
  const matches = text.match(/\w+/g) ?? [];
  const words = matches
    .filter(w => w.length > 1)
    .map(w => w.toLowerCase());
  return [ ...new Set(words) ];
}

