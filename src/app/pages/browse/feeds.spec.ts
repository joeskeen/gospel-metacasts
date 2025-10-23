import { TestBed } from '@angular/core/testing';

import { Feeds } from './feeds';

describe('Feeds', () => {
  let service: Feeds;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Feeds);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
